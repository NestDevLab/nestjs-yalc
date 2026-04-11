import { describe, it, expect } from '@jest/globals';

const { SkeletonUserType, SkeletonPhoneType } = await import('../index.js');

describe('Skeleton DTOs', () => {
  it('maps data into SkeletonUserType constructor', () => {
    const user = new SkeletonUserType({
      guid: 'test-guid',
      firstName: 'Alice',
      lastName: 'Doe',
      email: 'alice@example.com',
    });

    expect(user.guid).toBe('test-guid');
    expect(user.firstName).toBe('Alice');
    expect(user.lastName).toBe('Doe');
    expect(user.email).toBe('alice@example.com');
  });

  it('maps data into SkeletonPhoneType constructor', () => {
    const phone = new SkeletonPhoneType({
      ID: 1,
      phoneNumber: '+123456789',
      userId: 'user-guid',
    });

    expect(phone.ID).toBe(1);
    expect(phone.phoneNumber).toBe('+123456789');
    expect(phone.userId).toBe('user-guid');
  });
});
