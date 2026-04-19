---
title: NestJS-YALC
description: A CrudGen-first toolkit for generating NestJS REST and GraphQL backends without giving up explicit architecture.
permalink: /
layout: landing
---

<section class="ny-landing-hero">
  <img class="ny-hero-mark" src="assets/images/logo-small_yalc.png" alt="NestJS-YALC logo">
  <p class="ny-eyebrow">NestJS - Yet Another Library Collection</p>
  <h1>Make NestJS production-proof without rewriting the same backend glue.</h1>
  <p class="ny-lead">
    NestJS-YALC is built around three production pillars: CRUD Generation,
    API Strategy, and EventManager. Generate the standard surface, isolate
    module communication, and make runtime behavior observable from day one.
  </p>
  <div class="ny-actions">
    <a class="ny-button" href="{{ '/getting-started' | relative_url }}">Start in minutes</a>
    <a class="ny-link-button" href="{{ '/documentation' | relative_url }}">Explore the docs</a>
  </div>
  <ul class="ny-hero-points">
    <li>CRUD Generation</li>
    <li>API Strategy</li>
    <li>EventManager</li>
    <li>Observability</li>
  </ul>
</section>

<section class="ny-section ny-section--surface">
  <div class="ny-section-header">
    <h2>The three pillars.</h2>
    <p>
      The framework focuses on the parts that decide whether a NestJS backend
      stays maintainable in production: generated resource contracts, explicit
      service boundaries, and event-aware operations.
    </p>
  </div>

  <div class="ny-pillar-grid" aria-label="NestJS-YALC production pillars">
    <article class="ny-pillar ny-pillar--red">
      <p class="ny-pillar-number">01</p>
      <h3>CRUD Generation</h3>
      <p>
        Turn entity and DTO metadata into generated REST controllers, GraphQL
        resolvers, services, repositories, and dataloaders that share one
        contract.
      </p>
      <a href="{{ '/crud-gen-factory' | relative_url }}">Read CrudGen docs</a>
    </article>
    <article class="ny-pillar ny-pillar--teal">
      <p class="ny-pillar-number">02</p>
      <h3>API Strategy</h3>
      <p>
        Put module-to-module and service-to-service communication behind stable
        strategy tokens, so local calls, HTTP calls, and future transports can
        change without rewriting the caller.
      </p>
      <a href="{{ '/api-strategy' | relative_url }}">Read API Strategy docs</a>
    </article>
    <article class="ny-pillar ny-pillar--green">
      <p class="ny-pillar-number">03</p>
      <h3>EventManager</h3>
      <p>
        Standardize events, structured logs, HTTP-aware errors, and observability
        hooks with `YalcEventService` and OpenTelemetry integration patterns.
      </p>
      <a href="{{ '/event-manager-service' | relative_url }}">Read EventManager docs</a>
    </article>
  </div>
</section>

<section class="ny-section">
  <div class="ny-section-header">
    <h2>Production-proof by design.</h2>
    <p>
      NestJS-YALC is not only a utility collection. It is a backend operating
      model for teams that want generated APIs, clear boundaries, consistent
      errors, event trails, and observability without giving up NestJS.
    </p>
  </div>

  <div class="ny-grid">
    <article class="ny-card ny-card--red">
      <h3>Generated where possible</h3>
      <p>
        Standard CRUD stays generated. Domain behavior moves into service,
        repository, and metadata extension points instead of copy-pasted
        controllers and resolvers.
      </p>
    </article>
    <article class="ny-card ny-card--teal">
      <h3>Explicit across boundaries</h3>
      <p>
        API Strategy keeps cross-module calls out of core domain services and
        lets the same code run in a modular monolith or remote-service topology.
      </p>
    </article>
    <article class="ny-card ny-card--green">
      <h3>Observable at runtime</h3>
      <p>
        EventManager and Observability connect logs, errors, events, and traces
        into one operational story instead of leaving each module to improvise.
      </p>
    </article>
  </div>
</section>

<section class="ny-section ny-section--surface">
  <div class="ny-section-header">
    <h2>Used in real production contexts.</h2>
    <p>
      The framework patterns have been used in backend work for teams and
      products that needed stronger NestJS foundations.
    </p>
  </div>

  <div class="ny-logo-strip" aria-label="Organizations using NestJS-YALC patterns">
    <div class="ny-logo-mark">Bitvavo</div>
    <div class="ny-logo-mark">Embed</div>
  </div>
</section>

<section class="ny-section">
  <div class="ny-section-header">
    <h2>A tiny starting point.</h2>
    <p>
      The skeleton app is the smallest complete example: one resource definition
      exposes generated REST and GraphQL over an in-memory SQLite app.
    </p>
  </div>

  <pre class="ny-code-panel"><code class="language-ts">export const usersResource = CrudGenResourceFactory&lt;SkeletonUser&gt;({
  entityModel: SkeletonUser,
  backend: {
    service: { dbConnection: 'default', entityModel: SkeletonUser },
    dataloader: { databaseKey: 'guid' },
  },
  graphql: {
    resolver: {
      dto: SkeletonUserType,
      input: {
        create: SkeletonUserCreateInput,
        update: SkeletonUserUpdateInput,
        conditions: SkeletonUserCondition,
      },
      prefix: 'SkeletonModule_',
    },
  },
  rest: { dto: SkeletonUserType, path: 'users', idField: 'guid' },
});</code></pre>

  <div class="ny-actions">
    <a class="ny-button" href="{{ '/getting-started' | relative_url }}">Run the skeleton app</a>
    <a class="ny-link-button" href="{{ '/crud-gen-factory' | relative_url }}">Read the factory reference</a>
  </div>
</section>

<section class="ny-section ny-section--surface">
  <div class="ny-section-header">
    <h2>Full reference, clear path.</h2>
    <p>
      The landing page is custom, but the documentation area still uses the
      Git-Wiki theme and keeps the wiki navigation, search, page list, and
      tooling provided by the original site.
    </p>
  </div>

  <div class="ny-grid ny-grid--two">
    <article class="ny-card ny-card--red">
      <h3>New to the project?</h3>
      <p>
        Start with the short setup path, then open the skeleton app and copy the
        resource factory pattern into your own module.
      </p>
      <p><a href="{{ '/getting-started' | relative_url }}">Go to getting started</a></p>
    </article>
    <article class="ny-card ny-card--teal">
      <h3>Need the full wiki?</h3>
      <p>
        The documentation index keeps the guide list, repository notes, test
        commands, planning docs, and every existing reference page together.
      </p>
      <p><a href="{{ '/documentation' | relative_url }}">Open the documentation index</a></p>
    </article>
  </div>
</section>
