
# CAP App Cloud Foundry Deployment Instructions

This section outlines the steps to deploy a Cloud Application Programming (CAP) project with specific configurations for production environments (Cloud Foundry). Follow these steps to ensure your CAP app is correctly set up with necessary services and configurations.

## 1. Set Up Multi-Target Application (MTA)

To enable multi-target application deployment, initialize your project with MTA support:

```bash
cds add mta
```

## 2. Add Required Facets

For a production-ready environment, add the following required facets:

```bash
cds add xsuaa,hana --for production
```

## 3. UI Configuration

If your CAP application contains a UI component (Fiori/UI5 located in the `app` folder), include SAP Build Work Zone capabilities:

```bash
cds add workzone --for production
```

This will create an `xs-app.json` file in the `app` folder if it doesn't already exist, which is necessary for configuring routes to the CAP services.

### 3.1. Configure Routes in xs-app.json of the UI applications

Add a new route to manage requests to CAP service. Use the service path specified in the service definition (e.g., `@path: '/service/<service_name>'` in the CDS file) as the source of the route.

Place it at the top of the existing routes in `xs-app.json`:

```json
{
  "routes": [
    {
      "source": "^/service/(.*)$",
      "target": "/service/$1",
      "destination": "srv-api",
      "authenticationType": "xsuaa",
      "csrfProtection": true
    },
    // Existing routes follow here...
  ]
}
```

If there are multiple services, add a route for each service with the corresponding service path.


## 4. Destination Connectivity

If your application requires destination connectivity, configure it as follows:

```bash
cds add destination,connectivity --for production
```

## 5. Build and Deploy

Make sure you are logged in to Cloud Foundry and target the space you want to deploy to:

```bash
cf target
```

> If the user is not logged into Cloud Foundry, politely ask the user to log in manually.

If your project already includes a package-lock.json, freeze your updated dependencies:

```bash
npm install --package-lock-only
```

You can now build and deploy the application:

```bash
cds up
```
