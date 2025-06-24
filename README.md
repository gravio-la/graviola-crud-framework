# Graviola CRUD EDB Framework

A flexible, form-centric data management framework for working with linked data.

## Overview

The Graviola CRUD EDB Framework is a comprehensive solution for building applications that manage linked data through intuitive form-based interfaces. The project originated as a framework for managing metadata in cultural heritage institutions using semantic web technologies, focusing on performances, exhibitions, and collections involving geo-spatial event-centered entities and norm data mappings. It has since matured into a generic data management framework suitable for a wide range of applications.

The framework is built with a "convention before configuration" approach, making it flexible for various web applications with complex data models. Users can choose to use just the form-renderers with their own storage layer, or build a frontend application that works with a SPARQL endpoint. Backend engineers can use triple stores or other storage options like Prisma with JSON-schema, which still produces valid JSON-LD.

The Graviola framework enables:

- **Schema-driven development**: Define your data model once in JSON Schema and automatically generate forms, validation, queries, and more
- **Linked data management**: Seamlessly work with RDF data using familiar JSON structures
- **Flexible storage options**: Use in-memory stores for development or connect to any SPARQL 1.1 endpoint, Prisma-based relational databases, or custom REST backends
- **Composable UI components**: Build rich interfaces with specialized form renderers and components
- **Client-first architecture**: Run entirely in the browser or with optional server integration
- **Norm Data and secondary Data Sources**: The framework supports the use of norm data and secondary data sources to enrich the data model and link to entities in public linked data repositories (Wikidata, GND, DBpedia, etc.).
- **Declarative Mapping**: The framework supports the use of declarative mapping to map the data coming from secondary data sources to the current data model.

## Live Demo

A live demo of the exhibition catalog application (built with the Graviola framework) is available here: [https://slub.github.io/exhibition-live/](https://slub.github.io/exhibition-live/)

You can set your own storage backend(s) within the settings modal.

## Documentation

Please check the **[Storybook of the Graviola Framework](https://slub.github.io/exhibition-live/storybook/)** for in-depth documentation of the frontend components, CLI tools, and the overall architecture of the framework.

## Getting Started

For a quick start, install all dependencies, build the packages, and start the development server of the exhibition-live application:

```bash
bun i && bun build:packages && (cd apps/exhibition-live && bun run dev:vite)
```

Open [http://localhost:5173/de/list/Exhibition](http://localhost:5173/de/list/Exhibition) with your browser to see the result.

## Framework Architecture

The Graviola framework is structured as a monorepo with multiple packages that can be used independently or together:

### Core Packages

- **core-types**: Essential TypeScript type definitions
- **core-utils**: Common utility functions
- **sparql-schema**: Converts JSON Schema to SPARQL queries
- **state-hooks**: React hooks for state management
- **json-schema-utils**: Utilities for working with JSON Schema

### Form Rendering

- **semantic-json-form**: Main form component with JSON Schema support
- **form-renderer/**: Specialized form renderers for different data types
  - basic-renderer: Core form field renderers
  - color-picker-renderer: Color picker components
  - layout-renderer: Advanced layout renderers
  - linked-data-renderer: Renderers for linked data
  - map-libre-gl-renderer: Map integration
  - markdown-renderer: Markdown editing and preview

### Components

- **basic-components**: Fundamental UI components
- **advanced-components**: Complex UI components
- **table-components**: Data table components
- **virtualized-components**: Performance-optimized list components

### Data Management

- **data-mapping**: Utilities for data transformation
- **entity-finder**: Components for finding and selecting entities
- **sparql-db-impl**: SPARQL database implementation
- **prisma-db-impl**: Relational database implementation using Prisma ORM
- **simple-local-data-store**: In-memory data store
- **rest-store-provider**: REST interface for arbitrary backend implementations
- **local-oxigraph-store-provider**: Client-side Oxigraph implementation in a WebWorker

## Storage Endpoints

The framework can operate on a variety of storage endpoints:

- **Browser memory**: Default in-memory DB for testing and development
- **Oxigraph**: Lightweight SPARQL 1.1 endpoint that can run in a WebWorker for client-side storage
- **Other SPARQL 1.1 endpoints**: Jena Fuseki, Virtuoso, Blazegraph, GraphDB, etc.
- **Relational databases**: Via Prisma ORM integration
- **REST APIs**: Through the REST store provider for custom backend implementations

You can quickly launch an Oxigraph SPARQL 1.1 endpoint with Docker:

```bash
docker run -p 7878:7878 -v $(pwd)/data:/data -it ghcr.io/oxigraph/oxigraph:latest
```

Consult the [Oxigraph GitHub repository](https://github.com/oxigraph/oxigraph) for further information.

### Endpoint Configuration

Storage endpoints can be configured either dynamically at runtime using the settings modal or by providing a `SPARQL_ENDPOINT` environment variable at build time.

## Security Disclaimer

**Warning**: The SPARQL implementation in this framework was designed primarily for use with open knowledge bases, with a focus on supporting SPARQL-compliant endpoints. Security considerations were not the primary focus during development, and as such, there are potential vulnerabilities that users should be aware of:

- **Query Injection**: The current implementation may be susceptible to SPARQL query injection attacks.
- **Data Exposure**: There is a risk of unintended exposure of data from the graph due to insufficient access controls.

We acknowledge these limitations and plan to address them in future releases by implementing:

- Access Control Lists (ACLs)
- Query sanitization and validation (currently done by using @tpluscode/sparql-builder and @tpluscode/rdf-strings)
- Data masking and filtering capabilities

If you are using this framework in a production environment with sensitive data, we strongly recommend implementing additional security measures at the application or infrastructure level.

## Development

### Committing and Contributing

Please only commit linted and formatted code by using husky:

```bash
bun run prepare
```

### Storybook

This project uses [Storybook](https://storybook.js.org/) to document components and provide development examples:

```bash
cd apps/exhibition-live
bun i && bun run storybook
```

Open [http://localhost:6006](http://localhost:6006) with your browser to see the storybook.

### Testing

Unit tests of core functionality are done with `jest`. For integration tests of the frontend, `Cypress` is used.

### Using Docker

1. [Install Docker](https://docs.docker.com/get-docker/) on your machine.
2. Build your container: `docker build -t graviola-docker .`.
3. Run your container: `docker run -p 3000:3000 graviola-docker`.

#### Develop within Docker

```bash
docker compose up -d
docker compose exec exhibition-live /bin/bash
```

## Core Technologies

### JSON Schema and JSON Forms

The architecture is based on JSON-Forms with a flexible tester and renderer concept. JSON Schema is the foundation of the framework, used for:

- Form generation and validation
- Data conversion
- Query generation
- Document extraction
- Ontology generation and semantic mapping

### RDF and SPARQL

The framework uses the [RDFJS](https://rdf.js.org/) stack for RDF processing, enabling the same code to run in both browser and server environments:

- **@rdfjs/parser-n3**: RDF parsing and serialization of Turtle and N-Triples
- **@rdfjs/parser-jsonld**: RDF parsing and serialization of JSON-LD
- **@rdfjs/dataset**: Temporary in-memory RDF store
- **oxigraph**: SPARQL 1.1 compliant RDF storage in browser (WebWorker) or server
- **@tpluscode/rdfine**: Common RDF vocabularies and typesafe namespaces
- **@tpluscode/sparql-builder**: SPARQL query generation
- **clownface**: RDF graph traversal

### Database Implementations

- **Triple/Quad Stores**: SPARQL 1.1 endpoints like Oxigraph, Jena Fuseki, Virtuoso, Blazegraph, GraphDB
- **Relational Databases**: Via Prisma ORM integration that produces valid JSON-LD
- **REST APIs**: Custom backend implementations through the REST store provider
- **In-memory Stores**: For development and testing

### React and UI

- **React**: UI component library
- **Material UI**: Component design system (up to Version 6)
- **JSON Forms**: Form generation from JSON Schema
- **React Query**: Data fetching and caching
- **Zustand**: State management

### React compatibility

- **Next.js**: Next.js is supported and tested with the exhibition-live app
- **Vite React**: best React compatibility for the frontend

## Copyright and License

- Copyright © 2022-2025 Sebastian Tilsch
- Copyright © 2024 SLUB Dresden

This project is licensed under the GNU General Public License - see the LICENSE file for details.
