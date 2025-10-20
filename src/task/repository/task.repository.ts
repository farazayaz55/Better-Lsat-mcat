import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';

import { Task } from '../entities/task.entity';

@Injectable()
export class TaskRepository extends Repository<Task> {
  // Custom query methods can be added here if needed
  // For now, we'll use the standard TypeORM repository methods
}
