import { TasksDomainEventsService } from './tasks.domain-events.service';

describe('TasksDomainEventsService', () => {
  const log = jest.fn();
  const events = { log } as any;
  let service: TasksDomainEventsService;

  beforeEach(() => {
    log.mockReset();
    service = new TasksDomainEventsService(events);
  });

  it('emits a task created event with module-specific logger metadata', async () => {
    await service.emitTaskCreated('task-1', 'project-1');

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(['task-system', 'tasks', 'created'], {
      message: 'Task created',
      data: {
        taskId: 'task-1',
        projectId: 'project-1',
      },
      event: { await: true },
      eventAliases: ['tasks.created'],
      logger: expect.objectContaining({
        instance: expect.any(Object),
      }),
    });
  });

  it('emits a task status-changed event', async () => {
    await service.emitTaskStatusChanged('task-2', 'done');

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(['task-system', 'tasks', 'status-changed'], {
      message: 'Task status changed',
      data: {
        taskId: 'task-2',
        status: 'done',
      },
      event: { await: true },
      eventAliases: ['tasks.status-changed'],
      logger: expect.objectContaining({
        instance: expect.any(Object),
      }),
    });
  });
});
