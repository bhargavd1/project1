
# Integration to SAP CAP project

Please note that the integration should commence only after receiving explicit user approval.

**MANDATORY: Perform these steps in this exact order:**
1. Import the Data Product into CAP
2. Create Data Product Database Artifacts
  2.1 Add HANA for production
  2.2 Create/Update .hdiconfig File
  2.3 Create Synonyms
  2.4 Create Views
  2.5 Create Grants
  2.6 Update mta.yaml with grant service configurations and dependencies
3. Update the Database CDS Schema
4. Expose the Entity via the New CAP Service
5. Add Sample Data for Testing

## 1. Import the Data Product into CAP

Use the following command to generate the CDS artifacts from the downloaded metadata file:

```bash
script -qec 'cds import --data-product <saved_metadata_file_path> -s <serviceOrdId>' /dev/null
```

### Example

```bash
script -qec 'cds import --data-product /tmp/businessPartner.json -s sap.s4com:apiResource:BusinessPartner:v1' /dev/null
```

### Example Output

```
Importing APIs to apis/imported/sap-s4com-businesspartner-v1 ...

  > apis/imported/sap-s4com-businesspartner-v1/index.cds
  > apis/imported/sap-s4com-businesspartner-v1/services.cds
  > apis/imported/sap-s4com-businesspartner-v1/annotations.cds
...
```

## 2. Create the Data Product Database Artifacts to CAP `db/src` folder

You MUST define the HANA database artifacts to allow cross-container access to installed data product schema in HANA database.

### Prerequisites

Use `dataProductOrdId`, `dataProductId`, `serviceOrdId` from `service-center-mcp_get_resource_metadata` MCP tool call.

### 2.1 Add HANA for production

Run `cds add hana --for production` to add HANA database configuration.

### 2.2 Create/Update .hdiconfig File:
Under the `db/src` folder, create or update the `.hdiconfig` file with the following contents:

```json
{
  "file_suffixes": {
    "csv": {
      "plugin_name": "com.sap.hana.di.tabledata.source"
    },
    "hdbcalculationview": {
      "plugin_name": "com.sap.hana.di.calculationview"
    },
    "hdbconstraint": {
      "plugin_name": "com.sap.hana.di.constraint"
    },
    "hdbindex": {
      "plugin_name": "com.sap.hana.di.index"
    },
    "hdbtable": {
      "plugin_name": "com.sap.hana.di.table"
    },
    "hdbtabledata": {
      "plugin_name": "com.sap.hana.di.tabledata"
    },
    "hdbview": {
      "plugin_name": "com.sap.hana.di.view"
    },
    "hdbsynonym": {
      "plugin_name": "com.sap.hana.di.synonym"
    }
  }
}
```

### 2.3 Create the synonyms

**MANDATORY USER INPUT — DO NOT SKIP**:
You MUST stop and ask the user which entities they want to expose BEFORE creating any files.
DO NOT assume, default to all entities, or pick entities on behalf of the user.
DO NOT proceed until the user explicitly provides their selection.

STOP and ask the user:
```
The data product contains the following entities:

1. Entity A
2. Entity B
3. Entity C

Which entities would you like to expose?
(You can select one or more)
```

Wait for the user's response before continuing. Next, create <entity_name>.hdbsynonym files for each entity.

Generate synonym name via `echo "<entity_name>" | tr a-z A-Z` command.

Then use the following rules for target definition:

**Target schema:** `_SAP_DATAPRODUCT_<dataProductOrdId_updated>_<dataProductId>`

Note: `dataProductOrdId_updated` is the `dataProductOrdId` value with all periods (.) and colons (:) replaced by underscores (_).Example transformation:  `sap.s4com:dataProduct:Supplier:v1` becomes `sap_s4com_dataProduct_Supplier_v1`.

**Target table:** `_SAP_DATAPRODUCT_<serviceId>_<schema.entity_name>`

Note: verify that `dataProductId` and `serviceId` are in the UUID format.

Schema name shall be taken from `@data.product.schema` annotation of imported data product service.

**Example**:

`businesspartneremployment.hdbsynonym` file:

```json
{
  "BUSINESSPARTNEREMPLOYMENT": {
    "target": {
      "schema": "_SAP_DATAPRODUCT_sap_s4com_dataProduct_BusinessPartner_v1_d1937e24-efe2-4cfd-a3d3-0303467ce500",
      "object": "_SAP_DATAPRODUCT_ca56841e-a3c0-4d2f-9144-99f94126d1e7_BusinessPartner.BusinessPartnerEmployment"
    }
  }
}
```


### 2.4 Create views:

Create <entity_name>.hdbview files for each entity.

Structure the view name by combining the model name and entity name:
- Replace all **dashes (`-`)** in the model name with **underscores (`_`)** and convert to **uppercase**
- Append an **underscore (`_`)** separator.
- Append the **entity name**, converted to **uppercase** via `echo "<entity_name>" | tr a-z A-Z` command.

The name of the table in `FROM` clause should correspond to the synonym name defined previously.

**Example:** For a model `sap-s4com-businesspartner-v1` and entity `BusinessPartnerEmployment`, the view name would be `SAP_S4COM_BUSINESSPARTNER_V1_BUSINESSPARTNEREMPLOYMENT`.

`businesspartneremployment.hdbview` file:

```sql
VIEW SAP_S4COM_BUSINESSPARTNER_V1_BUSINESSPARTNEREMPLOYMENT AS SELECT
  SRC."BusinessPartner" AS BUSINESSPARTNER,
  SRC."BPEmploymentStatus" AS BPEMPLOYMENTSTATUS,
  SRC."BPEmploymentEndDate" AS BPEMPLOYMENTENDDATE,
  SRC."BPEmploymentStartDate" AS BPEMPLOYMENTSTARTDATE,
  SRC."BusPartEmplrIndstryCode" AS BUSPARTEMPLRINDSTRYCODE,
  SRC."BusinessPartnerEmployerName" AS BUSINESSPARTNEREMPLOYERNAME,
  SRC."BusinessPartnerOccupationGroup" AS BUSINESSPARTNEROCCUPATIONGROUP
FROM BUSINESSPARTNEREMPLOYMENT AS SRC
```

Ensure the view exposes all fields except navigations/associations. Each field and the view itself should have a capitalized alias.

### 2.5 Create <schema_name>.hdbgrants File:

**MANDATORY USER INPUT — DO NOT SKIP**:
You MUST stop and ask the user for the name of their user-provided grant service
BEFORE creating any `.hdbgrants` file or any other artifact that references it.
DO NOT use any default, invented, or placeholder name (e.g. `suppliergrant`, `mygrant`).
DO NOT proceed until the user explicitly provides this value.

STOP and ask the user:
```
What is the name of your user-provided grant service?
(This will be used as the key in the .hdbgrants file and as a resource in mta.yaml)
```

Wait for the user's response before continuing. 
Next:
**The key tag** is the name of the user-provided service specified by the user.
**Schema Logic:** Same as synonym: `_SAP_DATAPRODUCT_<dataProductOrdId>_<dataProductId>`
**Name Logic:** Same as synonym table: `_SAP_DATAPRODUCT_<serviceId>_<schema.entity_name>`


**Example**:

`businesspartner.hdbgrants` file:

```json
{
  "businesspartnergrant": {
    "object_owner": {
      "object_privileges": [
        {
          "schema": "_SAP_DATAPRODUCT_sap_s4com_dataProduct_BusinessPartner_v1_d1937e24-efe2-4cfd-a3d3-0303467ce500",
          "name": "_SAP_DATAPRODUCT_ca56841e-a3c0-4d2f-9144-99f94126d1e7_BusinessPartner.BusinessPartnerEmployment",
          "privileges_with_grant_option": ["SELECT"]
        }
      ]
    },
    "application_user": {
      "object_privileges": [
        {
          "schema": "_SAP_DATAPRODUCT_sap_s4com_dataProduct_BusinessPartner_v1_d1937e24-efe2-4cfd-a3d3-0303467ce500",
          "name": "_SAP_DATAPRODUCT_ca56841e-a3c0-4d2f-9144-99f94126d1e7_BusinessPartner.BusinessPartnerEmployment",
          "privileges": ["SELECT"]
        }
      ]
    }
  }
}
```

### 2.6 Update mta.yaml with grant service configuration and dependencies

You MUST run `cds add mta` to create an `mta.yaml` file in the root of the project. Then manually add a dependency to the user-provided grant service.to the db-deployer and a user-provided service configuration to the `resources` section. Also update the `srv` module configuration to ignore imported `apis` module in node_modules:

**Example**

```yaml
modules:
  - name: businesspartner-srv # srv module
    type: nodejs
    path: gen/srv
    parameters:
      instances: 1
      buildpack: nodejs_buildpack
    build-parameters:
      builder: npm-ci
      ignore: # add ignore
        - node_modules
        - package-lock.json
    ...
  - name: businesspartner-db-deployer # db-deployer
    type: hdb
    path: gen/db
    parameters:
      buildpack: nodejs_buildpack
    build-parameters:
      builder: npm
      ignore:
        - node_modules
        - package-lock.json
    requires:
      - name: businesspartner-service-uaa
      - name: businesspartner-service-db
      - name: businesspartnergrant # add a dependency
      ...
      
resources:
  - name: businesspartnergrant # new resource
    type: org.cloudfoundry.existing-service
```

## 3. Update the database CDS schema

Expose the entity (entities) in the persistence layer by creating a **federated projection**.

CAP generates the following folder:

```
apis/imported/<namespace>/
```

Inside this folder you will find:

```
index.cds
services.cds   ← contains the entity definitions
annotations.cds
```

**`services.cds` is the file you must reference** because it contains the service entities derived from the external API.

---

### How to find the correct entity name

Open:

```
apis/imported/<namespace>/services.cds
```

Inside you will see something similar to:

```cds
@cds.dp.ordId : 'sap.s4com:apiResource:BusinessPartner:v1'
@cds.external : true
@data.product : true
@protocol : 'none'
@data.product.schema : 'BusinessPartner'
service sap.s4com.BusinessPartner.v1 {
    entity BusinessPartnerEmployment {
        key BusinessPartner : String(10);
        ...
    }
}
```

From this definition:

* **Service namespace** → `sap.s4com.BusinessPartner.v1`
* **Entity name** → `BusinessPartnerEmployment`

This gives you the full import path:

```
sap.s4com.BusinessPartner.v1.BusinessPartnerEmployment
```

**Tip:**
If you are unsure which file to reference, always:

1. Open the generated `services.cds`
2. Locate the service + entity name
3. Copy the fully qualified name into the `using` statement

### Setup Before Creating a Federated Projection

1. **Create a New Folder and File:**
Under the `db` folder, create a new folder named `hana`:

```
db/hana
```

In the `db/hana` folder, create a new file named `index.cds`.

2. **Add Annotation:**
In `index.cds`, include the `@cds.persistence.exists` annotation to specify that the entity exists in persistence. Example:

```cds
using { sap.s4com.BusinessPartner.v1.BusinessPartnerEmployment as dpBusinessPartnerEmployment } from '../../apis/imported/sap-s4com-businesspartner-v1/services';

annotate dpBusinessPartnerEmployment with @cds.persistence.exists;
```

3. **Update package.json Configuration:**
Modify the `package.json` file to add profile-specific configuration for database-specific extensions:

```json
{
  "cds": {
    "requires": {
       "[production]": {
          "db": {
            "kind": "hana",
            "model": "db/hana"
           }
       }
    }
  }
}
```


### Projection Creation Example (`db/schema.cds`)

```cds
using { sap.s4com.BusinessPartner.v1.BusinessPartnerEmployment as dpBusinessPartnerEmployment } 
  from '../apis/imported/sap-s4com-businesspartner-v1/services';

namespace businesspartnerapp;

@federated entity BusinessPartnerEmployment as
    projection on dpBusinessPartnerEmployment
    {
        key BusinessPartner,
        BusinessPartnerName,
        BusinessPartnerDescription
    };
```

#### What Happens Here?

* `using` imports the external entity definition.
* `@federated` marks the entity as remote (no local table created).
* The projection defines which fields are exposed to your application.
* You can reduce, rename, or extend fields as needed.

## 4. Expose the Entity via the new CAP Service

Create a new service definition to make the projected entity available.

### Example (`srv/business-partner-service.cds`)

```cds
using { businesspartnerapp } from '../db/schema';

@path : '/service/businessPartnerService'
service businessPartnerService {
    @readonly
    entity BusinessPartnerEmployment as
        projection on businesspartnerapp.BusinessPartnerEmployment;
}
```

## 5. Add sample data for testing

You MUST create a CSV file for the projected external entity to test locally before connecting to the live service.

### Action Required:

**Create a CSV file for the projected external entity** (e.g., the `BusinessPartnerEmployment` entity from the external service)

### Steps:
1. Create a `test/data/` folder in your CAP project if it doesn't exist
2. Create a CSV file named after the projected entity (e.g., `schema-BusinessPartnerEmployment.csv` for the BusinessPartnerEmployment projection in the schema namespace)
3. Add column headers matching the projected entity fields
4. Add sample rows with test data

#### Example: If you projected BusinessPartnerEmployment entity, create (test/data/schema-BusinessPartnerEmployment.csv):
```csv
BusinessPartner;BusinessPartnerName;BusinessPartnerDescription
BP001;John Doe;Senior Sales Associate
BP002;Jane Smith;Marketing Manager
BP003;Bob Johnson;IT Specialist
```