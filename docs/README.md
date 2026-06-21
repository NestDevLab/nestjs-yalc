---
title: NestJS-YALC
description: A CrudGen-first toolkit for generating NestJS REST and GraphQL backends without giving up explicit architecture.
permalink: /
layout: landing
---

<section class="ny-landing-hero">
  <div class="ny-hero-content">
    <img class="ny-hero-mark" src="assets/images/logo-small_yalc.png" alt="NestJS-YALC logo">
    <p class="ny-eyebrow">NestJS production toolkit</p>
    <h1>Production-grade NestJS, generated from your domain model.</h1>
    <p class="ny-lead">
      Define resources once. NestJS-YALC generates CRUD APIs, protects service
      boundaries with API Strategy, and standardizes events, errors, and
      observability with EventManager.
    </p>
    <div class="ny-hero-install" aria-label="Install NestJS-YALC">
      <p class="ny-install-label">Install the full framework</p>
<pre class="ny-install-command"><code>npm install @nestjs-yalc/framework</code></pre>
      <p class="ny-install-alt">...or just what you need:</p>
      <div class="ny-package-chips" aria-label="Install individual packages">
        {% for pkg in site.data.public_packages %}
        <a class="ny-package-chip" href="{{ pkg.npmUrl }}" target="_blank" rel="noopener">{{ pkg.shortName }}</a>
        {% endfor %}
      </div>
    </div>
    <div class="ny-actions">
      <a class="ny-button" href="{{ '/getting-started' | relative_url }}">Start in minutes</a>
      <a class="ny-link-button" href="{{ '/documentation' | relative_url }}">Open the wiki</a>
    </div>
  </div>

  <div class="ny-showcase" aria-label="NestJS-YALC component showcase">
    <input class="ny-showcase-input" type="radio" name="ny-showcase" id="ny-showcase-crud" checked>
    <input class="ny-showcase-input" type="radio" name="ny-showcase" id="ny-showcase-strategy">
    <input class="ny-showcase-input" type="radio" name="ny-showcase" id="ny-showcase-events">

    <div class="ny-showcase-tabs" role="tablist" aria-label="Showcase components">
      <label for="ny-showcase-crud" role="tab">CRUD Generation</label>
      <label for="ny-showcase-strategy" role="tab">API Strategy</label>
      <label for="ny-showcase-events" role="tab">Event Manager</label>
    </div>

    <div class="ny-showcase-panels">
      <article class="ny-showcase-panel ny-showcase-panel--crud">
        <p class="ny-showcase-intro">
          Define a resource once. YALC turns it into REST, GraphQL, service,
          repository, and dataloader surfaces that share the same contract.
        </p>
<pre class="ny-code-panel"><code class="language-typescript">export const usersResource = CrudGenResourceFactory&lt;SkeletonUser&gt;({
  entityModel: SkeletonUser,
  graphql: true,
  rest: true,
});</code></pre>
        <div class="ny-visual-output ny-visual-output--crud" aria-label="Generated CRUD output">
          <div class="ny-resource-node">
            <span>Resource model</span>
            <strong>SkeletonUser</strong>
          </div>
          <div class="ny-crud-grid">
            <div class="ny-api-card">
              <span class="ny-scene-label">REST controller</span>
              <div class="ny-endpoint-row"><span>GET</span><strong>/skeleton-user?$top=20</strong></div>
              <div class="ny-endpoint-row"><span>GET</span><strong>/skeleton-user/:id</strong></div>
              <div class="ny-endpoint-row"><span>POST</span><strong>/skeleton-user</strong></div>
              <div class="ny-endpoint-row"><span>PUT</span><strong>/skeleton-user/:id</strong></div>
              <div class="ny-endpoint-row"><span>DELETE</span><strong>/skeleton-user/:id</strong></div>
            </div>
            <div class="ny-api-card ny-api-card--graphql">
              <span class="ny-scene-label">GraphQL resolver</span>
              <div class="ny-query-row"><span>query</span><strong>getSkeletonUser</strong></div>
              <div class="ny-query-row"><span>query</span><strong>getSkeletonUserGrid</strong></div>
              <div class="ny-query-row"><span>mutation</span><strong>createSkeletonUser</strong></div>
            </div>
          </div>
          <div class="ny-loader-rail">
            <span>DataLoader cache</span>
            <i></i>
            <i></i>
            <i></i>
          </div>
        </div>
        <div class="ny-showcase-actions">
          <a class="ny-button" href="{{ '/crud-gen-factory' | relative_url }}">Read CrudGen docs</a>
          <a class="ny-link-button" href="{{ '/getting-started' | relative_url }}">Run the skeleton app</a>
        </div>
      </article>

      <article class="ny-showcase-panel ny-showcase-panel--strategy">
        <p class="ny-showcase-intro">
          Keep caller and emitter code stable while the selected strategy swaps
          between local calls, HTTP calls, and event emission.
        </p>
        <div class="ny-strategy-showcase">
          <input class="ny-strategy-input" type="radio" name="ny-strategy" id="ny-strategy-local" checked>
          <input class="ny-strategy-input" type="radio" name="ny-strategy" id="ny-strategy-http">
          <input class="ny-strategy-input" type="radio" name="ny-strategy" id="ny-strategy-event">

          <div class="ny-strategy-tabs" aria-label="API Strategy examples">
            <label for="ny-strategy-local">Local call</label>
            <label for="ny-strategy-http">HTTP call</label>
            <label for="ny-strategy-event">Event strategy</label>
          </div>

          <div class="ny-strategy-panels">
            <div class="ny-strategy-panel ny-strategy-panel--local">
              <pre class="ny-code-panel"><code class="language-typescript">{
  provide: USERS_API,
  useFactory: (adapter, cls, config) =>
    new NestLocalCallStrategy(adapter, cls, config),
}

@Injectable()
export class UsersApiClient {
  constructor(
    @Inject(USERS_API)
    private readonly api: IHttpCallStrategy,
  ) {}

  listUsers() {
    return this.api.get('/users');
  }
}</code></pre>
              <div class="ny-visual-output ny-visual-output--strategy" aria-label="Local API Strategy output">
                <div class="ny-strategy-call-card">
                  <span>same client call</span>
                  <strong>await usersApi.listUsers()</strong>
                </div>
                <div class="ny-service-node">
                  <span>Caller</span>
                  <strong>UsersApiClient</strong>
                </div>
                <div class="ny-strategy-router">
                  <span>Strategy token</span>
                  <strong>USERS_API</strong>
                </div>
                <div class="ny-service-node ny-service-node--target">
                  <span>Same runtime</span>
                  <strong>Nest app</strong>
                </div>
                <div class="ny-transport-lanes">
                  <div class="ny-transport-lane ny-transport-lane--local">
                    <span>transport</span>
                    <strong>Fastify inject('/users')</strong>
                  </div>
                  <div class="ny-strategy-result">
                    <span>output</span>
                    <strong>200 { list, pageData }</strong>
                  </div>
                </div>
              </div>
            </div>

            <div class="ny-strategy-panel ny-strategy-panel--http">
              <pre class="ny-code-panel"><code class="language-typescript">{
  provide: USERS_API,
  useFactory: (http, cls) =>
    new NestHttpCallStrategy(http, cls, process.env.USERS_BASE_URL ?? ''),
}

@Injectable()
export class UsersApiClient {
  constructor(
    @Inject(USERS_API)
    private readonly api: IHttpCallStrategy,
  ) {}

  listUsers() {
    return this.api.get('/users');
  }
}</code></pre>
              <div class="ny-visual-output ny-visual-output--strategy" aria-label="HTTP API Strategy output">
                <div class="ny-strategy-call-card">
                  <span>same client call</span>
                  <strong>await usersApi.listUsers()</strong>
                </div>
                <div class="ny-service-node">
                  <span>Caller</span>
                  <strong>UsersApiClient</strong>
                </div>
                <div class="ny-strategy-router">
                  <span>Strategy token</span>
                  <strong>USERS_API</strong>
                </div>
                <div class="ny-service-node ny-service-node--target">
                  <span>Remote API</span>
                  <strong>Users service</strong>
                </div>
                <div class="ny-transport-lanes">
                  <div class="ny-transport-lane ny-transport-lane--http">
                    <span>transport</span>
                    <strong>Axios GET /users</strong>
                  </div>
                  <div class="ny-strategy-result">
                    <span>output</span>
                    <strong>200 { list, pageData }</strong>
                  </div>
                </div>
              </div>
            </div>

            <div class="ny-strategy-panel ny-strategy-panel--event">
              <pre class="ny-code-panel"><code class="language-typescript">{
  provide: USER_EVENTS,
  useFactory: (eventManager: YalcEventService) =>
    new NestLocalEventStrategy(eventManager.emitter),
  inject: [YalcEventService],
}

class UsersEventsClient {
  constructor(
    @Inject(USER_EVENTS)
    private readonly events: IEventStrategy,
  ) {}

  userCreated(userId: string) {
    return this.events.emitAsync('user.created', { userId });
  }
}</code></pre>
              <div class="ny-visual-output ny-visual-output--strategy" aria-label="Event API Strategy output">
                <div class="ny-strategy-call-card">
                  <span>same event contract</span>
                  <strong>emitAsync('user.created', payload)</strong>
                </div>
                <div class="ny-service-node">
                  <span>Emitter</span>
                  <strong>UserService</strong>
                </div>
                <div class="ny-strategy-router">
                  <span>Event token</span>
                  <strong>USER_EVENTS</strong>
                </div>
                <div class="ny-service-node ny-service-node--target">
                  <span>EventManager</span>
                  <strong>YalcEventService</strong>
                </div>
                <div class="ny-transport-lanes">
                  <div class="ny-transport-lane ny-transport-lane--event">
                    <span>local branch</span>
                    <strong>events.emitter.emitAsync(...)</strong>
                  </div>
                  <div class="ny-strategy-result">
                    <span>output</span>
                    <strong>listeners + logs + optional broker</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="ny-showcase-actions">
          <a class="ny-button" href="{{ '/api-strategy' | relative_url }}">Read API Strategy docs</a>
        </div>
      </article>

      <article class="ny-showcase-panel ny-showcase-panel--events">
        <p class="ny-showcase-intro">
          EventManager centralizes logs, domain events, and HTTP-aware errors
          behind one YalcEventService call surface. Observability can subscribe
          to the same stream and export traces, metrics, and logs.
        </p>
        <pre class="ny-code-panel"><code class="language-typescript">@Injectable()
export class UserService {
  constructor(
    private readonly events: YalcEventService,
    private readonly users: UserRepository,
  ) {}

  async findOrFail(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) {
      throw this.events.errorNotFound('user.notFound', {
        data: { userId },
      });
    }

    await this.events.logAsync(['user', 'loaded'], {
      data: { userId },
    });

    return user;
  }
}</code></pre>
        <div class="ny-visual-output ny-visual-output--events" aria-label="EventManager and Observability output">
          <div class="ny-event-flow">
            <div class="ny-event-stream">
              <span class="ny-event-dot"></span>
              <div>
                <span>event source</span>
                <strong>user.loaded</strong>
              </div>
            </div>
            <div class="ny-event-timeline">
              <span>structured log</span>
              <span>listener notified</span>
              <span>HTTP-aware error</span>
            </div>
            <div class="ny-structured-event">
              <span>{ "event": "user.loaded" }</span>
              <strong>userId: 42</strong>
            </div>
          </div>
          <div class="ny-telemetry-stack">
            <div class="ny-telemetry-card ny-telemetry-card--traces">
              <span>Traces</span>
              <i></i>
              <i></i>
              <i></i>
            </div>
            <div class="ny-telemetry-card ny-telemetry-card--metrics">
              <span>Metrics</span>
              <i></i>
              <i></i>
              <i></i>
            </div>
            <div class="ny-otlp-route">
              <span>OTLP export</span>
              <strong>127.0.0.1:4318</strong>
            </div>
          </div>
        </div>
        <div class="ny-showcase-actions">
          <a class="ny-button" href="{{ '/event-manager-service' | relative_url }}">Read EventManager docs</a>
          <a class="ny-link-button" href="{{ '/observability' | relative_url }}">Read Observability docs</a>
        </div>
      </article>
    </div>
  </div>
</section>

<section class="ny-section ny-section--surface">
  <div class="ny-section-header ny-section-header--center">
    <h2>Everything NestJS gives you, plus the YALC production layer.</h2>
    <p>
      NestJS already gives you modular architecture, dependency injection,
      TypeScript, and a strong backend ecosystem. YALC adds generated resource
      contracts, swappable service boundaries, operational primitives, and
      pre-optimized modules with AppBootstrap helpers for production-ready
      NestJS applications.
    </p>
  </div>

  <div class="ny-capability-grid" aria-label="NestJS capabilities extended by YALC">
    <article class="ny-capability-card ny-capability-card--red">
      <div class="ny-capability-meta">
        <p class="ny-capability-number">01</p>
        <span class="ny-capability-icon ny-capability-icon--blocks" aria-hidden="true"></span>
      </div>
      <h3>Extensible modules</h3>
      <p>
        Keep Nest's module-first structure and generate the repetitive resource
        layer around explicit entity, DTO, service, and repository contracts.
      </p>
      <div class="ny-capability-tags">
        <span>Modules</span>
        <span>DI</span>
        <span>Typed contracts</span>
      </div>
    </article>
    <article class="ny-capability-card ny-capability-card--teal">
      <div class="ny-capability-meta">
        <p class="ny-capability-number">02</p>
        <span class="ny-capability-icon ny-capability-icon--waypoints" aria-hidden="true"></span>
      </div>
      <h3>Versatile APIs</h3>
      <p>
        Build REST, GraphQL, event-driven flows, and background-ready boundaries
        from the same resource definitions instead of hand-maintaining each surface.
      </p>
      <div class="ny-capability-tags">
        <span>REST</span>
        <span>GraphQL</span>
        <span>Events</span>
      </div>
    </article>
    <article class="ny-capability-card ny-capability-card--green">
      <div class="ny-capability-meta">
        <p class="ny-capability-number">03</p>
        <span class="ny-capability-icon ny-capability-icon--network" aria-hidden="true"></span>
      </div>
      <h3>Progressive boundaries</h3>
      <p>
        Move from one runtime to distributed services by switching strategy
        providers while preserving the caller contract and testable Nest wiring.
      </p>
      <div class="ny-capability-tags">
        <span>Local calls</span>
        <span>HTTP</span>
        <span>Microservices</span>
      </div>
    </article>
    <article class="ny-capability-card ny-capability-card--yellow">
      <div class="ny-capability-meta">
        <p class="ny-capability-number">04</p>
        <span class="ny-capability-icon ny-capability-icon--activity" aria-hidden="true"></span>
      </div>
      <h3>Everything you need to operate it</h3>
      <p>
        Add structured events, HTTP-aware errors, traces, metrics, and logs so
        generated backends are easier to observe, debug, and evolve in production.
      </p>
      <div class="ny-capability-tags">
        <span>Errors</span>
        <span>Logs</span>
        <span>OTLP</span>
      </div>
    </article>
  </div>
</section>

<section class="ny-section ny-section--logos">
  <div class="ny-section-header ny-section-header--center">
    <h2>Used in real production contexts.</h2>
    <p>
      The framework patterns have been used in backend work for teams and
      products that needed stronger NestJS foundations.
    </p>
  </div>

  <div class="ny-logo-strip" aria-label="Organizations using NestJS-YALC patterns">
    <a class="ny-logo-mark" href="https://bitvavo.com/" target="_blank" rel="noopener">
      <img src="assets/images/logo-bitvavo.svg" alt="Bitvavo">
    </a>
    <a class="ny-logo-mark" href="https://www.embed.co/" target="_blank" rel="noopener">
      <img src="assets/images/logo-embed.svg" alt="Embed">
    </a>
    <a class="ny-logo-mark ny-logo-mark--azerothcore" href="https://www.azerothcore.org/" target="_blank" rel="noopener">
      <img src="assets/images/logo-azerothcore.png" alt="AzerothCore emblem">
      <span>AzerothCore</span>
    </a>
    <div class="ny-logo-mark ny-logo-mark--static">
      <img src="assets/images/logo-tirrenia.svg" alt="Tirrenia">
    </div>
  </div>
</section>

<section class="ny-section">
  <div class="ny-section-header ny-section-header--center">
    <h2>Explore the full documentation.</h2>
    <p>
      Move from first setup to production architecture, generated resources,
      runtime strategies, EventManager, observability, and runnable examples.
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
      <h3>Need the full reference?</h3>
      <p>
        The documentation index groups architecture guides, package references,
        example applications, test commands, and publication notes.
      </p>
      <p><a href="{{ '/documentation' | relative_url }}">Open the documentation index</a></p>
    </article>
  </div>
</section>
