import { ProjectsDomainEventsService } from './projects.domain-events.service';

describe('ProjectsDomainEventsService', () => {
  const log = jest.fn();
  const events = { log } as any;
  let service: ProjectsDomainEventsService;

  beforeEach(() => {
    log.mockReset();
    service = new ProjectsDomainEventsService(events);
  });

  it('emits a project created event with module-specific logger metadata', async () => {
    await service.emitProjectCreated('project-1', 'Alpha');

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(['task-system', 'projects', 'created'], {
      message: 'Project created',
      data: {
        projectId: 'project-1',
        name: 'Alpha',
      },
      event: { await: true },
      eventAliases: ['projects.created'],
      logger: expect.objectContaining({
        instance: expect.any(Object),
      }),
    });
  });
});
