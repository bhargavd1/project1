# CAP Analytical Service

A CAP analytical service exposes **cubes** over existing entities for use with SAP HANA Cloud and SAP Analytics Cloud. It is a regular CDS service file placed in `srv/`.

---


## Project Setup

Run these commands once in the CAP project root before adding an analytical service:

```sh
cds add hana
npm add @sap/cds-analytics
npm add @sap/cds-adapter-ina-js
```

`cds add hana` configures the project for SAP HANA Cloud deployment (adds `@cap-js/hana` and updates `package.json` with the required CDS build profile). The two npm packages provide the analytics runtime and the InA protocol adapter.

---

## Service Declaration

An analytical service uses the `ina` protocol:

```cds
@protocol: 'ina'
service FlightAnalytics { ... }
```

---

## Dimension Entities

Source entities that serve as lookup/grouping targets must be annotated outside the service:

```cds
annotate travel.Airport with
  @ObjectModel.modelingPattern: #ANALYTICAL_DIMENSION
  @ObjectModel.supportedCapabilities: [#ANALYTICAL_DIMENSION];
```

---

## Analytical Cubes

Each cube is a `SELECT` projection inside the service, annotated as a provider:

```cds
@ObjectModel.modelingPattern: #ANALYTICAL_CUBE
@ObjectModel.supportedCapabilities: [#ANALYTICAL_PROVIDER]
entity FlightByAirport as select from travel.Flight { ... }
```

Add `@title` for a human-readable label:

```cds
@ObjectModel.modelingPattern: #ANALYTICAL_CUBE
@ObjectModel.supportedCapabilities: [#ANALYTICAL_PROVIDER]
@title: 'Flights by Airport'
entity FlightByAirport as select from travel.Flight { ... }
```

---

## Dimensions

### Simple dimension

Use when the field maps directly from the source entity. If the cube field name differs from the source, use an alias:

```cds
FlightStatus as status,
```

### Foreign-key association dimension

Use when the dimension is backed by a to-one association in the source entity. The field uses `association.Key` syntax and the association itself must be redirected to the dimension entity:

```cds
@ObjectModel.foreignKey.association: Airport
@title: 'Departure Airport'
Airport.ID as AirportID, // use alias for key to avoid conflicts with Airport_ID generated field
...
Airport,
```

`@ObjectModel.foreignKey.association` names the association that provides the foreign key context.

---

## Measures

Every measure requires `@AnalyticsDetails.measureType: #BASE`.

### SUM (default)

No additional aggregation annotation needed:

```cds
@AnalyticsDetails.measureType: #BASE
@title: 'Total Price'
Price as TotalPrice,
```

### Non-SUM aggregations (MAX, MIN, AVG)

Add `@Aggregation.default`:

```cds
@AnalyticsDetails.measureType: #BASE
@Aggregation.default: #MAX
@title: 'Max Price'
Price as MaxPrice,
```

### COUNT

Uses a constant expression `1 as <name>: Integer`:

```cds
@AnalyticsDetails.measureType: #BASE
@Aggregation.default: #COUNT
1 as FlightCount: Integer,
```

### COUNT_DISTINCT

Requires `@Aggregation.referenceElement` listing the dimension fields whose unique combinations are counted:

```cds
@AnalyticsDetails.measureType: #BASE
@Aggregation.default: #COUNT_DISTINCT
@Aggregation.referenceElement: [ConnectionID, AirlineID]
1 as AirlineConnectionCount : Integer,
```

### Calculated measures

Calculated measures are derived from other `#BASE` measures after aggregation has been performed. They cannot reference fields from the cube's data source directly — only other measures via `$self`.

```cds
@AnalyticsDetails.measureType: #BASE
MaximumSeats,

@AnalyticsDetails.measureType: #BASE
OccupiedSeats,

@AnalyticsDetails.measureType: #CALCULATION
$self.MaximumSeats - $self.OccupiedSeats as AvailableSeats : Integer,
```

Key rules:
- Prefix measure references with `$self.`
- Always declare an explicit type on the expression (e.g. `: Integer`, `: Decimal`)
- `@Aggregation.default` is ignored for calculated measures
- Mixing measures with incompatible units (e.g. a currency measure with a plain numeric measure) produces a result marked as "mixed" by the analytical engine

---

## Monetary Measures

When a measure aggregates a currency-coded amount, annotate it with `@Measures.ISOCurrency` pointing to the currency code virtual field, and include the currency field as a dimension:

```cds
Currency,   // dimension — the Currency association from @sap/cds/common

@AnalyticsDetails.measureType: #BASE
@Measures.ISOCurrency: Currency_code // virtual key
@title: 'Total Price'
Price as totalPrice,
```

`Currency_code` is the scalar key of the `Currency` association. The source entity must expose a `Currency` association typed from `@sap/cds/common`.

> Do not add a separate `Currency_code` dimension manually when using `@Measures.ISOCurrency` — including the `Currency` field in the projection is sufficient.

---

## Complete Example

For the following database `schema.cds`:
```cds
namespace my.travel;

using { Country, Currency, cuid } from '@sap/cds/common';

entity Airport : cuid {
    Name    : String(40);
    Country : Country;
}

entity Airline : cuid {
    Name : String(40);
}

entity FlightConnection : cuid {
    DepartureAirport   : Association to Airport;
    DestinationAirport : Association to Airport;
}

entity Flight : cuid {
    key FlightDate    : Date;
        Price         : Decimal(16, 3);
        Currency      : Currency;
        MaximumSeats  : Integer;
        OccupiedSeats : Integer;
        Airline       : Association to Airline;
        Connection    : Association to FlightConnection;
}
```

The analytical service can be the following:
```cds
using { my.travel as travel } from '../db/schema';

annotate travel.Airport with
  @ObjectModel.modelingPattern: #ANALYTICAL_DIMENSION
  @ObjectModel.supportedCapabilities: [#ANALYTICAL_DIMENSION];

annotate travel.Airport with {
  @ObjectModel.text.element: Name
  ID;
  @Semantics.text: true
  Name;
};

annotate travel.Airline with
  @ObjectModel.modelingPattern: #ANALYTICAL_DIMENSION
  @ObjectModel.supportedCapabilities: [#ANALYTICAL_DIMENSION];

annotate travel.Airline with {
  @ObjectModel.text.element: Name
  ID;
  @Semantics.text: true
  Name;
};

annotate travel.FlightConnection with
  @ObjectModel.modelingPattern: #ANALYTICAL_DIMENSION
  @ObjectModel.supportedCapabilities: [#ANALYTICAL_DIMENSION];


@protocol: 'ina'
service FlightAnalytics {

  @ObjectModel.modelingPattern: #ANALYTICAL_CUBE
  @ObjectModel.supportedCapabilities: [#ANALYTICAL_PROVIDER]
  @title: 'Flights by Airport'
  entity FlightByAirport as select from travel.Flight {
    // dimension fields
    ID as FlightID,

    @ObjectModel.foreignKey.association: Airline
    Airline.ID as AirlineID,
    Airline,  // include the full association so it is redirected to the dimension entity

    @ObjectModel.foreignKey.association: Connection
    Connection.ID as ConnectionID,
    Connection,  // include the full association so it is redirected to the dimension entity

    Currency,

    // --- navigation attributes ---

    // add fields (denormalization)
    @Common.Label: '{i18n>DepartureAirport}'
    Connection.DepartureAirport.ID as DepartureAirportID,
    @Common.Label: '{i18n>DestinationAirport}'
    Connection.DestinationAirport.ID as DestinationAirportID,

    @Common.Label: '{i18n>DepartureCountry}'
    Connection.DepartureAirport.Country.code as DepartureCountryCode,
    @Common.Label: '{i18n>DestinationCountry}'
    Connection.DestinationAirport.Country.code as DestinationCountryCode,

    // Monetary SUM measure
    @AnalyticsDetails.measureType: #BASE
    @Measures.ISOCurrency: Currency_code
    @title: 'Total Price'
    Price as TotalPrice,

    @AnalyticsDetails.measureType: #BASE
    @title: 'Maximum Seats'
    MaximumSeats,

    @AnalyticsDetails.measureType: #BASE
    @title: 'Occupied Seats'
    OccupiedSeats,

    // Profit
    @AnalyticsDetails.measureType: #BASE
    OccupiedSeats * Price as Profit : Decimal,

    // COUNT measure
    @AnalyticsDetails.measureType: #BASE
    @Aggregation.default: #COUNT
    1 as FlightCount: Integer,

    // COUNT_DISTINCT measure
    @AnalyticsDetails.measureType: #BASE
    @Aggregation.default: #COUNT_DISTINCT
    @Aggregation.referenceElement: [ConnectionID, AirlineID]
    1 as AirlineConnectionCount : Integer,

    // Calculated measure
    @AnalyticsDetails.measureType: #CALCULATION
    @Common.Label: '{i18n>AvailableSeats}'
    $self.MaximumSeats - $self.OccupiedSeats as AvailableSeats : Integer,  // only sees other elements of the cube

  }

}
```
