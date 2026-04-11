import { describe, it, expect } from '@jest/globals';

const { SkeletonUser } = await import('../skeleton-user.entity.js');

describe('SkeletonUser entity', () => {
  it('hydrates derived fullName after load when missing', () => {
    const user = new SkeletonUser();
    user.firstName = 'Alice';
    user.lastName = 'Doe';
    user.fullName = undefined as any;

    user.hydrateDerivedFields();

    expect(user.fullName).toBe('Alice Doe');
  });

  it('does not override fullName when already present', () => {
    const user = new SkeletonUser();
    user.firstName = 'Alice';
    user.lastName = 'Doe';
    user.fullName = 'Existing Name';

    user.hydrateDerivedFields();

    expect(user.fullName).toBe('Existing Name');
  });

  it('leaves fullName empty when no source names exist', () => {
    const user = new SkeletonUser();
    user.firstName = '' as any;
    user.lastName = '' as any;
    user.fullName = undefined as any;

    user.hydrateDerivedFields();

    expect(user.fullName).toBeUndefined();
  });
});
