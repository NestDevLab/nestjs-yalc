---
title: NestJS-YALC
description: A CrudGen-first toolkit for generating NestJS REST and GraphQL backends without giving up explicit architecture.
permalink: /
layout: landing
---

<section class="ny-landing-hero">
  <div class="ny-hero-output" aria-hidden="true">
    <div class="ny-mini-code">
      <span class="ny-mini-code-dot"></span>
      <span class="ny-mini-code-line ny-mini-code-line--long"></span>
      <span class="ny-mini-code-line"></span>
      <span class="ny-mini-code-line ny-mini-code-line--mid"></span>
      <span class="ny-mini-code-line ny-mini-code-line--short"></span>
    </div>
    <div class="ny-generated-surface">
      <span>REST</span>
      <span>GraphQL</span>
      <span>Dataloader</span>
      <span>API Strategy</span>
      <span>Events</span>
      <span>Traces</span>
    </div>
  </div>

  <div class="ny-hero-content">
    <img class="ny-hero-mark" src="assets/images/logo-small_yalc.png" alt="NestJS-YALC logo">
    <p class="ny-eyebrow">NestJS - Yet Another Library Collection</p>
    <h1>Generate the boilerplate. Keep the production architecture.</h1>
    <p class="ny-lead">
      NestJS-YALC turns NestJS metadata into generated REST and GraphQL APIs,
      API Strategy boundaries, and EventManager-powered observability.
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
    <h2>Three things matter most.</h2>
    <p>
      The project is built around the three parts that usually decide whether a
      NestJS backend stays maintainable in production.
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

<section class="ny-section ny-section--logos">
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

<section class="ny-section ny-section--split ny-section--surface">
  <div class="ny-section-header">
    <h2>Start from one resource.</h2>
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

<section class="ny-section">
  <div class="ny-section-header">
    <h2>The wiki stays where docs belong.</h2>
    <p>
      The landing page is only the entry point. The full documentation still
      uses the Git-Wiki theme with search, navigation, page lists, and the
      existing reference content.
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
