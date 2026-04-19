---
title: NestJS-YALC
description: A CrudGen-first toolkit for generating NestJS REST and GraphQL backends without giving up explicit architecture.
permalink: /
layout: landing
---

<section class="ny-landing-hero">
  <div class="ny-hero-visual" aria-hidden="true">
    <span>ModelObject</span>
    <span>DTO</span>
    <span>REST</span>
    <span>GraphQL</span>
    <span>Strategy Token</span>
    <span>Event Trail</span>
    <span>Trace</span>
  </div>

  <div class="ny-hero-content">
    <img class="ny-hero-mark" src="assets/images/logo-small_yalc.png" alt="NestJS-YALC logo">
    <p class="ny-eyebrow">NestJS - Yet Another Library Collection</p>
    <h1>Production-proof NestJS, generated from explicit architecture.</h1>
    <p class="ny-lead">
      NestJS-YALC turns the repetitive backend layer into a predictable system:
      generated CRUD, strategy-based API boundaries, and EventManager-powered
      observability from the first module.
    </p>
    <div class="ny-actions">
      <a class="ny-button" href="{{ '/getting-started' | relative_url }}">Start in minutes</a>
      <a class="ny-link-button" href="{{ '/documentation' | relative_url }}">Open the wiki</a>
    </div>
    <ul class="ny-hero-points">
      <li>CRUD Generation</li>
      <li>API Strategy</li>
      <li>EventManager</li>
      <li>Observability</li>
    </ul>
  </div>
</section>

<section class="ny-section ny-section--surface">
  <div class="ny-section-header">
    <h2>The production core.</h2>
    <p>
      Three primitives carry the project: generate the standard API surface,
      make communication explicit, and keep every operational signal connected.
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

<section class="ny-system-section">
  <div class="ny-section-header">
    <h2>One resource definition becomes a production surface.</h2>
    <p>
      The value is visual: a model is not just a class, it becomes typed APIs,
      module-safe communication, dataloading, structured errors, logs, events,
      and traces.
    </p>
  </div>

  <div class="ny-system-map" aria-label="NestJS-YALC generated production flow">
    <div class="ny-system-node ny-system-node--source">
      <span>01</span>
      <strong>Model metadata</strong>
      <small>ModelObject + ModelField</small>
    </div>
    <div class="ny-system-arrow"></div>
    <div class="ny-system-node">
      <span>02</span>
      <strong>Generated contracts</strong>
      <small>REST + GraphQL + Dataloader</small>
    </div>
    <div class="ny-system-arrow"></div>
    <div class="ny-system-node">
      <span>03</span>
      <strong>API Strategy</strong>
      <small>Stable service boundaries</small>
    </div>
    <div class="ny-system-arrow"></div>
    <div class="ny-system-node ny-system-node--sink">
      <span>04</span>
      <strong>EventManager</strong>
      <small>Errors + logs + traces</small>
    </div>
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
    <div class="ny-logo-mark">
      <img src="assets/images/logo-bitvavo.svg" alt="Bitvavo">
    </div>
    <div class="ny-logo-mark">
      <img src="assets/images/logo-embed.svg" alt="Embed">
    </div>
  </div>
</section>

<section class="ny-section ny-section--split">
  <div class="ny-section-header">
    <h2>A tiny starting point.</h2>
    <p>
      The skeleton app is the smallest complete example: one resource definition
      exposes generated REST and GraphQL over an in-memory SQLite app.
    </p>
    <div class="ny-actions">
      <a class="ny-button" href="{{ '/getting-started' | relative_url }}">Run the skeleton app</a>
      <a class="ny-link-button" href="{{ '/crud-gen-factory' | relative_url }}">Read the factory reference</a>
    </div>
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
