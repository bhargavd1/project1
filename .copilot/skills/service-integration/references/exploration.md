# External Service Discovery and Selection

Follow these steps to discover and integrate external services:

## Step 1: Discover Available Systems

**MCP Tool**: `service-center-mcp_list_systems`

1. Call the tool with appropriate `dataType`:
   - `SAP System Service` - for OData Services


2. **MANDATORY USER SELECTION — DO NOT SKIP**:
   - You MUST present the complete list of systems to the user and STOP.
   - DO NOT automatically choose a system, if more than one result is returned.
   - If only one system is found, proceed with it automatically without asking the user.
   - DO NOT proceed to the next step until the user explicitly selects a system.
   - Format the list clearly with system names and IDs.

   STOP and ask the user: "Which system would you like to search for external services?" and wait for their response.

Example:
```
I found the following systems:
1. System A (ID: sys-001)
2. System B (ID: sys-002)
3. System C (ID: sys-003)

Which system would you like to search for external services?
```


## Step 2: Search and Select External Services

**MCP Tool**: `service-center-mcp_search_resources`

1. Use the systemId from Step 1 and a search query from the user
2. Configure search parameters:
   - Set `protocol` filter if needed
   - Adjust `limit` based on expected results (default: 10, max: 100)

3. **MANDATORY USER SELECTION — DO NOT SKIP**:
   - You MUST present the complete search results to the user and STOP.
   - DO NOT automatically choose a service, even if only one result is returned.
   - DO NOT proceed to integration until the user explicitly selects a service.
   - If only one service is found, you MUST still ask the user to confirm it.
   - Show service names, IDs, versions, and descriptions.

   STOP and ask the user: "Which service would you like to integrate?" and wait for their response.

Example:
```
I found these services matching "purchase":
1. Purchase Contract (ID: PURCHSE_CONTRACT_0001) - OData V4 Service
2. Purchase Spending (ID: C_PURCHASE_SPENDING) - OData V2 Service

Which service would you like to integrate?
```

## Step 3: Retrieve Service Metadata

**MCP Tool**: `service-center-mcp_get_resource_metadata`

1. Use the systemId and resourceId from previous steps
2. **ALWAYS** set `outputMetadataToFile: true` to save the metadata file to `/tmp/<resourceId>.xml`, which is required for CAP integration
3. Review the metadata information with the user before proceeding

**Tool returns:**
- `metadataInformation`: Entity structures, fields, and relationships
- `metadataFilePath`: Path to saved metadata file
- `cdsImportCommand`: Command to import the service
- `destinationConfig`: Configuration for .env file
