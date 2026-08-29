import { BadRequestException, NotFoundException } from '@nestjs/common';
import { IsNull, type Repository } from 'typeorm';
import { OmniRecordEntity } from './base/omni-record.entity.js';
import { OmniExternalRefInternalType } from './omni-external-ref-internal-type.enum.js';
import type { OmniScope } from './omni-scope.js';

export interface OmniExternalRefBinding {
  internalId: string;
  internalType: OmniExternalRefInternalType;
}

/**
 * Reusable validation for an external reference whose declared target is an
 * Omni record identity. Other internal types remain legacy application-owned
 * identities and are intentionally not passed to this validator.
 */
export class OmniExternalRefBindingValidator {
  constructor(
    private readonly recordRepository: Repository<OmniRecordEntity>,
    private readonly scope: OmniScope,
  ) {}

  async assertTarget(
    binding: OmniExternalRefBinding,
  ): Promise<OmniRecordEntity> {
    if (binding.internalType !== OmniExternalRefInternalType.Record) {
      throw new BadRequestException(
        'Omni external record binding must declare internalType record.',
      );
    }
    if (
      typeof binding.internalId !== 'string' ||
      binding.internalId.trim().length === 0
    ) {
      throw new BadRequestException(
        'Omni external reference internalId must be a non-empty record identity.',
      );
    }
    const record = await this.recordRepository.findOne({
      where: {
        scopeId: this.scope.scopeId,
        guid: binding.internalId,
        deletedAt: IsNull(),
      },
    });
    if (!record) {
      throw new NotFoundException(
        'Omni external reference target was not found in this scope.',
      );
    }
    return record;
  }
}
