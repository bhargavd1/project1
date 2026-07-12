# Data Product Discovery and Selection

Follow these steps to discover and explore Data Products:

## Step 1: Discover Available Systems

**MCP Tool**: `service-center-mcp_list_systems`

1. Call the tool with appropriate `dataType`:
   - `UCL Data Product` - for data products


2. **MANDATORY USER SELECTION — DO NOT SKIP**:
   - You MUST present the complete list of systems to the user and STOP.
   - DO NOT automatically choose a system, if more than one result is returned.
   - If only one system is found, proceed with it automatically without asking the user.
   - DO NOT proceed to the next step until the user explicitly selects a system.
   - Format the list clearly with system names and IDs.

   STOP and ask the user: "Which system would you like to search for data products?" and wait for their response.

Example:
```
I found the following systems:
1. System A (ID: sys-001)
2. System B (ID: sys-002)
3. System C (ID: sys-003)

Which system would you like to search for data products?
```


## Step 2: Search and Select Data Products

**MCP Tool**: `service-center-mcp_search_resources`

1. Use the systemId from Step 1 and a search query from the user
2. Configure search parameters:
   - Set `version` filter if needed
   - Adjust `limit` based on expected results (default: 10, max: 100)

3. **MANDATORY USER SELECTION — DO NOT SKIP**:
   - You MUST present the complete search results to the user and STOP.
   - DO NOT automatically choose a data product, even if only one result is returned.
   - DO NOT proceed to integration until the user explicitly selects a data product.
   - If only one data product is found, you MUST still ask the user to confirm it.
   - Show data product names, IDs, versions, and descriptions.

   STOP and ask the user: "Which data product would you like to integrate?" and wait for their response.

Example:
```
I found these resources matching "purchase":
1. Purchase Analytics (ID: PA_DP) - Data Product
2. Purchase Contract Analytics (ID: SO_DP) - Data Product

Which data product would you like to integrate?
```

## Step 3: Retrieve Data Product Metadata

**MCP Tool**: `service-center-mcp_get_resource_metadata`

1. Use the systemId and resourceId (data product uuid) from previous steps
2. **ALWAYS** set `outputMetadataToFile: true` to have the tool save the metadata file to `/tmp/<resourceId>.json`, which is required for the CAP integration step.
