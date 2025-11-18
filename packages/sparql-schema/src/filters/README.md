# SPARQL Filter System - Prisma-Style WHERE Clauses

This module provides a type-safe, Prisma-style filtering system for SPARQL queries.

## Features

- **Type-safe filters**: Full TypeScript inference from Zod schemas
- **Prisma-style syntax**: Familiar API for developers coming from Prisma
- **Optimized SPARQL**: Generates efficient SPARQL patterns (triple patterns > VALUES > FILTER)
- **Extensible**: Easy to add custom operators and SPARQL flavour support

## Quick Start

```typescript
import { filterToSparql } from '@graviola/sparql-schema/filters';
import type { TypedWhereInput } from '@graviola/edb-graph-traversal';

// Type-safe filters with Zod
const personSchema = z.object({
  name: z.string(),
  email: z.string(),
  age: z.number(),
  verified: z.boolean(),
});

type Person = z.infer<typeof personSchema>;

// Full type safety - IDE autocomplete works!
const where: TypedWhereInput<Person> = {
  name: { contains: 'John' },        // String operators
  age: { gte: 18, lte: 65 },         // Numeric operators
  verified: { equals: true },         // Boolean operators
  email: { endsWith: '@company.com' } // String operators
};
```

## Supported Operators

### String Operators

- `equals`: Exact match
- `not`: Not equal
- `in`: Match any value in array
- `notIn`: Don't match any value in array
- `contains`: Contains substring (case-sensitive by default)
- `startsWith`: Starts with prefix
- `endsWith`: Ends with suffix
- `mode`: `'default'` | `'insensitive'` for case sensitivity

```typescript
{
  email: { 
    endsWith: '@gmail.com',
    mode: 'insensitive'  // Case-insensitive search
  }
}
```

### Numeric Operators

- `equals`: Exact match
- `not`: Not equal
- `in`: Match any value in array
- `notIn`: Don't match any value in array
- `gt`: Greater than
- `gte`: Greater than or equal
- `lt`: Less than
- `lte`: Less than or equal

```typescript
{
  age: {
    gte: 18,  // Must be 18 or older
    lt: 65    // and younger than 65
  }
}
```

### Boolean Operators

- `equals`: Exact match
- `not`: Not equal

```typescript
{
  verified: { equals: true }
}
```

### Logical Operators

- `AND`: All conditions must match
- `OR`: At least one condition must match
- `NOT`: Condition must not match

```typescript
{
  OR: [
    { email: { endsWith: '@gmail.com' } },
    { email: { endsWith: '@company.com' } }
  ],
  NOT: {
    email: { endsWith: '@spam.com' }
  }
}
```

## SPARQL Generation

The filter system generates optimized SPARQL patterns:

### Equals Operator
```typescript
{ age: { equals: 25 } }
```
Generates:
```sparql
?person :age 25 .
```

### In Operator (VALUES clause)
```typescript
{ status: { in: ['active', 'pending'] } }
```
Generates:
```sparql
VALUES ?status { "active" "pending" }
?person :status ?status .
```

### String Operators (SPARQL functions)
```typescript
{ email: { endsWith: '@gmail.com' } }
```
Generates:
```sparql
?person :email ?email .
FILTER(STRENDS(?email, "@gmail.com"))
```

### OR Operator (Combined FILTER)
```typescript
{ 
  OR: [
    { email: { endsWith: '@gmail.com' } },
    { email: { endsWith: '@company.com' } }
  ]
}
```
Generates:
```sparql
?person :email ?email .
FILTER(STRENDS(?email, "@gmail.com") || STRENDS(?email, "@company.com"))
```

### NOT Operator (FILTER NOT EXISTS)
```typescript
{ NOT: { email: { contains: 'spam' } } }
```
Generates:
```sparql
FILTER NOT EXISTS {
  ?person :email ?email .
  FILTER(CONTAINS(?email, "spam"))
}
```

## Architecture

The filter system is organized in three layers:

1. **Type Definitions** (`graph-traversal/typed-filters`): Type-safe filter types with schema inference
2. **Filter Translators** (`sparql-schema/filters`): Convert filter objects to SPARQL patterns
3. **Integration**: Used by schema2construct functions to apply filters

### Directory Structure

```
sparql-schema/src/filters/
├── types.ts                 # Filter context and result types
├── filterToSparql.ts       # Main orchestrator
├── operators/
│   ├── comparison.ts       # equals, not, in, notIn
│   ├── numeric.ts          # gt, gte, lt, lte
│   ├── string.ts           # contains, startsWith, endsWith
│   └── logical.ts          # AND, OR, NOT
├── utils/
│   ├── datatype.ts         # Datatype inference
│   └── variable.ts         # Variable name generation
└── flavours/
    └── default.ts          # Standard SPARQL 1.1
```

## Examples

### Simple Filter
```typescript
const where = {
  name: { contains: 'John' }
};
```

### Range Query
```typescript
const where = {
  age: {
    gte: 18,
    lte: 65
  }
};
```

### Complex Filter with Logical Operators
```typescript
const where = {
  OR: [
    { status: { equals: 'active' } },
    { status: { equals: 'pending' } }
  ],
  AND: [
    { verified: { equals: true } },
    { age: { gte: 18 } }
  ],
  NOT: {
    email: { endsWith: '@blocked.com' }
  }
};
```

### Case-Insensitive Search
```typescript
const where = {
  name: {
    contains: 'john',
    mode: 'insensitive'
  }
};
```

### Multiple Values (IN)
```typescript
const where = {
  status: {
    in: ['active', 'pending', 'approved']
  }
};
```

## Type Safety

The system provides full TypeScript type safety:

```typescript
const personSchema = z.object({
  name: z.string(),
  age: z.number(),
});

type Person = z.infer<typeof personSchema>;

// ✅ Valid - string operator on string property
const valid: TypedWhereInput<Person> = {
  name: { contains: 'John' }
};

// ❌ Type Error - string operator on number property
const invalid: TypedWhereInput<Person> = {
  age: { contains: '25' }  // TypeScript error!
};
```

## Performance Considerations

The filter system generates optimal SPARQL patterns:

1. **Triple patterns** (fastest) for `equals`
2. **VALUES clause** for `in` operator
3. **FILTER expressions** for other operators
4. **SPARQL string functions** (CONTAINS, STRSTARTS, STRENDS) instead of REGEX when possible

## Future Extensions

- **DateTime operators**: Planned for date/time filtering
- **Geo filters**: Support for spatial queries (Blazegraph flavour)
- **Full-text search**: Integration with SPARQL flavour-specific features
- **UNION support**: Complex OR queries spanning different patterns

## Testing

Run the test suite:

```bash
bun test --testPathPattern=filters
```

## Contributing

When adding new operators:

1. Add type definitions in `graph-traversal/typed-filters.ts`
2. Implement the operator in appropriate `operators/*.ts` file
3. Add unit tests
4. Update this README with examples
