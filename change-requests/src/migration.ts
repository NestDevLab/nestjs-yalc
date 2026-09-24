import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateChangeRequests1727164800000 implements MigrationInterface {
  name = 'CreateChangeRequests1727164800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const dateType =
      queryRunner.connection.driver.options.type === 'postgres'
        ? 'timestamp'
        : 'datetime';
    await queryRunner.createTable(
      new Table({
        name: 'change_requests',
        columns: [
          { name: 'id', type: 'varchar', isPrimary: true },
          { name: 'entity_type', type: 'varchar' },
          { name: 'target', type: 'varchar' },
          { name: 'entity_id', type: 'varchar' },
          { name: 'title', type: 'varchar', isNullable: true },
          { name: 'proposer_kind', type: 'varchar' },
          { name: 'proposer_id', type: 'varchar', isNullable: true },
          { name: 'proposer_label', type: 'varchar' },
          { name: 'source_json', type: 'text', isNullable: true },
          { name: 'note', type: 'varchar', isNullable: true },
          { name: 'created_at', type: dateType, default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: dateType, default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );
    await queryRunner.createTable(
      new Table({
        name: 'change_request_items',
        columns: [
          { name: 'id', type: 'varchar', isPrimary: true },
          { name: 'change_request_id', type: 'varchar' },
          { name: 'entity_type', type: 'varchar' },
          { name: 'target', type: 'varchar' },
          { name: 'entity_id', type: 'varchar' },
          { name: 'field_key', type: 'varchar' },
          { name: 'variant', type: 'varchar', default: "''" },
          { name: 'state', type: 'varchar', default: "'proposed'" },
          { name: 'base_hash', type: 'varchar' },
          { name: 'base_value', type: 'text', isNullable: true },
          { name: 'proposed_value', type: 'text', isNullable: true },
          { name: 'publish_error', type: 'varchar', isNullable: true },
        ],
        foreignKeys: [
          {
            columnNames: ['change_request_id'],
            referencedTableName: 'change_requests',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'change_request_items',
      new TableIndex({
        name: 'uq_change_request_open_field',
        columnNames: [
          'entity_type',
          'target',
          'entity_id',
          'field_key',
          'variant',
        ],
        isUnique: true,
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('change_request_items', true);
    await queryRunner.dropTable('change_requests', true);
  }
}
