# Integration to SAP CAP Project

**IMPORTANT:** Integration should commence only after receiving explicit user approval.

Ask the user:
```
Would you like to add this service to your project?
```

Only proceed if confirmed. **Perform these steps in this exact order.**

## Step 1: Add npm Script to package.json

**Description:** Add npm script to package.json

**Action:**
1. **MUST Read** the package.json file first
2. Add the following script to the scripts section:

```json
"start:live": "cds watch --profile live"
```

**Note:** This script allows running the CAP server with the live profile and live data. To run the app, the user can use: `npm run start:live`. **DO NOT run it yourself** - explain it to the user.

## Step 2: Import Service Metadata

Use the `cdsImportCommand` returned from the metadata tool,

**Note:** Run this command from the CAP project root directory

## Step 3: Configure Destination in .env File

**Description:** Configure destination in .env file

**IMPORTANT Instructions:**
- If the .env file already exists and contains a `destinations=` entry:
  - Check if there is already a destination with the same system ID
  - If found: Update it
  - If not found: Add the new destination to the existing array
- If the file or `destinations=` entry does not exist: Create it with the configuration

**Configuration:**
Use the `destinationConfig` returned from the metadata tool.

## Step 4: Create Projection (Optional)

**Ask the user:**
```
Would you like to create a projection of the service with a read handler?
This allows you to expose and customize data from the external service.
```

**If user confirms, follow these requirements:**

### Requirements
To achieve a projection, you need:
1. **db/schema.cds**: Define a projection on the external entity
2. **srv/service.cds**: Expose that projection in the service
3. **srv/service.js**: A simple "pass-through" handler that delegates the query to the remote system

### Reference Example

#### 1. Data Model (db/schema.cds)
```cds
// Add new using statement    
using { ZPAGE_BUILDER_CONF } from '../srv/external/ZPAGE_BUILDER_CONF.cds';  // You MUST use the external service only here and not in the service.js

// Define the new Projection
entity Pages as
    projection on ZPAGE_BUILDER_CONF.Pages
    {
        pageId, // key
        title,
        catalogId,
        isReadOnly
    };
```

#### 2. Service Definition (srv/service.cds)
```cds
using { schema } from '../db/schema';
service SupplierManagementService {
    @readonly
    entity Pages as projection on schema.Pages; // Use the projection on the internal projection in the schema.cds (schema.Pages) and not the one from the external service.
}
```

#### 3. Service Implementation (srv/service.js)
```javascript
const cds = require('@sap/cds');

module.exports = cds.service.impl(async function () {
    
    // Connect to external service
    const ZPAGE_BUILDER_CONF = await cds.connect.to('ZPAGE_BUILDER_CONF');

    // Simple Delegation
    this.on('READ', 'Pages', async (req) => {
        try { 
            return await ZPAGE_BUILDER_CONF.run(req.query); 
        }
        catch (error) { 
            // Fallback (e.g., if external service is down)
            return cds.run(req.query); 
        }
    });
});
```

## Step 5: Create Associations (Optional)

**Ask the user:**
```
Would you like to create a one-to-one association between the external service's entity and a local entity?
```

**If user confirms:**
1. Ask which entities should be associated
2. Follow the association pattern below

### Requirements
Since CAP cannot perform database joins across remote services, you must implement **"Manual Data Stitching"** in the handler.

Required changes:
1. **db/schema.cds**: Add the `Association` field to the local entity
2. **srv/service.cds**: Expose both entities (local and projected external) in the service
3. **srv/service.js**: Implement a handler for the **local entity** (not the external one) to:
   - Intercept the `READ` event
   - Inject the foreign key ID into the columns (if the user requested an expansion)
   - Run the local query
   - Fetch the external data using the IDs found
   - Merge the results
4. **Use `get_service_live_data` tool**: Before creating sample data, fetch real key field values from the external service to use as foreign key values

### Reference Example

#### 1. Data Model (db/schema.cds)
```cds
using { ZPAGE_BUILDER_CONF } from '../srv/external/ZPAGE_BUILDER_CONF.cds'; 

// 1. The Projected External Entity
entity Pages as
    projection on ZPAGE_BUILDER_CONF.Pages
    {
        pageId,
        title,
        catalogId,
        isReadOnly
    };

// 2. The Local Entity with Managed Association
entity Suppliers : cuid, managed {
  name : String(100);
  
  // The managed association to the internal projection and not the external service directly
  // The managed association implicitly uses a column named 'extPage_pageId'
  extPage : Association to Pages; 
}
```

#### 2. Service Definition (srv/service.cds)
```cds
using { schema } from '../db/schema';

service SupplierManagementService {
    // Expose the local entity with the association
    // This projection includes all fields from schema.Suppliers, including the extPage association
    // **DO NOT** perform navigation along association inside this projection, such as extPage.pageId as pageId as it causes an error
    entity Suppliers as projection on schema.Suppliers;
    
    // Expose the projected external entity
    // This projection includes all fields from schema.Pages (pageId, title, catalogId, isReadOnly)
    // Mark as readonly since it's from an external service
    @readonly
    entity Pages as projection on schema.Pages;
}
```

**Important Notes:**
- Both projections expose **all fields** from their respective schema entities
- Use `schema.Suppliers` and `schema.Pages` (the internal projections), NOT the external service entities directly
- The Suppliers projection automatically includes the `extPage` association defined in the schema
- The Pages entity is marked `@readonly` because it represents data from an external service

#### 3. Service Implementation (srv/service.js)
```javascript
const cds = require('@sap/cds');

module.exports = cds.service.impl(async function () {
    
    const ZPAGE_BUILDER_CONF = await cds.connect.to('ZPAGE_BUILDER_CONF');

    this.on('READ', 'Suppliers', async (req, next) => {
        
        // --- STEP A: Foreign Key Injection ---
        // If the user requests 'extPage' (expansion), we MUST ensure 'extPage_pageId' is selected.
        const columns = req.query.SELECT.columns;
        const expandIndex = columns?.findIndex(c => c.ref && c.ref[0] === 'extPage');

        if (columns && expandIndex > -1) {
            const hasForeignKey = columns.find(c => c.ref && c.ref[0] === 'extPage_pageId');
            if (!hasForeignKey) {
                columns.push({ ref: ['extPage_pageId'] });
            }
        }

        // --- STEP B: Run Local Query ---
        const suppliers = await next();
        if (!suppliers) return suppliers;

        // --- STEP C: Manual Enrichment ---
        const asArray = Array.isArray(suppliers) ? suppliers : [suppliers];

        if (expandIndex > -1) {
            await enrichSuppliersWithPages(asArray, ZPAGE_BUILDER_CONF);
        }

        return suppliers;
    });
});

// Helper Function to Stitch Data
async function enrichSuppliersWithPages(suppliers, pageService) {
    // 1. Collect IDs
    const pageIds = [...new Set(suppliers.map(s => s.extPage_pageId).filter(id => id != null))];
    if (pageIds.length === 0) return;

    // 2. Fetch Remote Data
    const remotePages = await pageService.run(
        SELECT.from('ZPAGE_BUILDER_CONF.Pages').where({ pageId: { in: pageIds } })
    );

    // 3. Map & Merge
    const pageMap = new Map(remotePages.map(p => [p.pageId, p]));
    suppliers.forEach(supplier => {
        if (supplier.extPage_pageId && pageMap.has(supplier.extPage_pageId)) {
            supplier.extPage = pageMap.get(supplier.extPage_pageId);
        }
    });
}
```

## Step 6: Add Sample Data (Optional)

**Ask the user:**
```
Would you like to add sample data for testing?
```

**If confirmed, follow these instructions based on what was created:**

### Sample Data for Projections
If you created a projection, you MUST create a CSV file for the projected external entity to test locally.

**Steps:**
1. Create a `test/data/` folder in the CAP project if it doesn't exist
2. Create a CSV file named after the projected entity (e.g., `schema-Pages.csv`)
3. Add column headers matching the projected entity fields
4. Add sample rows with test data

**Example:** `test/data/schema-Pages.csv`
```csv
pageId,title,catalogId,isReadOnly
page1,Home Page,catalog1,false
page2,About Page,catalog1,true
page3,Contact Page,catalog2,false
```

### Sample Data for Associations
If you created associations, you need sample data for BOTH entities.

**CRITICAL: Use `get_service_live_data` Tool First**

Before creating sample data, **MUST use the `get_service_live_data` tool** to fetch real key field values from the external service entity.

**Complete Workflow:**

#### Step A: Fetch Real IDs
**MCP Tool**: `service-center-mcp_get_service_live_data`

Execute the tool for the external entity (e.g., Pages).

**Parameters:**
```javascript
{
  systemId: "<system_id>",
  serviceId: "<service_id>",
  entitySetName: "Pages",
  limit: 20
}
```

Tool returns actual data, for example:
```json
[
  { "pageId": "page001", "title": "Home Page", "catalogId": "cat1", "isReadOnly": false },
  { "pageId": "page002", "title": "About Page", "catalogId": "cat1", "isReadOnly": true },
  { "pageId": "page003", "title": "Contact Page", "catalogId": "cat2", "isReadOnly": false }
]
```

**Note down the real IDs:** page001, page002, page003.

**DO NOT COPY** other field data to prevent live data leaks in the CSV files.

#### Step B: Create CSV for External Entity
Create `test/data/schema-Pages.csv` with ONLY the IDs from live data, but different values for other fields:
```csv
pageId,title,catalogId,isReadOnly
page001,Products page,cat4,true
page002,Orders Page,cat10,false
page003,Main Page,cat20,false
```

#### Step C: Create CSV for Local Entity
Create `test/data/schema-Suppliers.csv` using the real IDs as foreign key values:
```csv
ID,name,extPage_pageId
supplier1,Acme Corp,page001
supplier2,Global Ltd,page002
supplier3,Tech Inc,page001
```

**Why This Matters:**
- Using real IDs from `get_service_live_data` ensures foreign keys match actual records
- When you test with `$expand=extPage`, the handler will successfully fetch and stitch the real external data
- This validates your association logic works correctly before deploying

**File Naming Convention:**
- Format: `namespace-EntityName.csv`
- Example: `schema-Pages.csv`, `schema-Suppliers.csv`
- The namespace matches what's defined in your CDS files
