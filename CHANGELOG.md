Rev: 1.4.0
=============

## Additions

* Export the public `@nestjs-yalc/omnikernel-module` package from the aggregate framework.



Rev: 1.2.1
=============
 
## Additions

* Created documentation for API

## Changes

* Improved generic-resolver type hinting
* Improved code documentation
* Fixed issue with Dataloader where it returned the same result with different parameters
* Add possibility to enable synchronize options for specific db connections
* Change the way we disable typeorm logging to completely avoid logs when TYPEORM_LOGGING is false
* Improved returnValue type-hinting
* Fix tsconfig for dev



Rev: 1.1.0
=============
 ## Added
- New kafka generic controller for nest microservices applications
- Avro deserializer
- Generic interface for debezium data
- New logic in extraArgs: possibility to add a fixed filter with runtime value assignment.

## Changed
- join field type is only JoinType

## Fixed
- DateType  graphql scalar
- Fixed filterConditions problem with some filter on Date type
- Fixed One-to-many relationship problem with nested resource as aggrid type
