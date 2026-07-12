# Integration to SAP Fiori Project

## Create a SAP Fiori Project based on an External OData Service (No CAP App Required)

This guide describes how to create a standalone SAP Fiori elements application directly on top of an external OData service discovered via the Service Center MCP tools.

### Prerequisites

- Access to the SAP Fiori MCP tools
- Access to the Service Center MCP tools
- A service already selected from the Service Center (see [exploration guide](exploration.md))

---

## Notes

**From the Get Resource Metadata tool response, note down:**
- `metadataFilePath`: path to the saved metadata XML file (e.g., `/tmp/Z_SALES_ORDER_CDS_0001.xml`)
- The service `url` from the earlier search result:
  - `host`: construct the base URL of the destination using the following pattern: `https://<systemId>.dest`, e.g., `https://JYD.dest`
  - `servicePath`: the OData endpoint path, e.g., `/sap/opu/odata/sap/Z_SALES_ORDER_CDS`


**Key mapping from Service Center MCP → Fiori MCP parameters:**

| Service Center MCP output | Fiori MCP input |
|---------------------------|---------------------------|
| `systemId` (from list_systems) | construct the `host` patameter |
| `metadataFilePath` (from get_resource_metadata) | `service.metadataFilePath` |
| `serviceEntities.<EntityName>` (from get_resource_metadata) | `entityConfig.mainEntity.entityName` |
| `protocolType` (from get_resource_metadata) | informs floorplan choice (V4-only floorplans need `odatav4`) |

---

## Important Information

- After generation, run `npm install` in the generated app folder before starting the app.
- The `metadataFilePath` must point to the XML file saved by `get_resource_metadata` — do not skip `outputMetadataToFile: true`.
- If the service URL from search results is a relative path (starts with `/sap/...`), construct the full host from the known system base URL.