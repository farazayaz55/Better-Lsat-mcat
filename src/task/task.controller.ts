import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiExtraModels,
} from '@nestjs/swagger';

import { AppLogger } from '../shared/logger/logger.service';
import { RequestContext } from '../shared/request-context/request-context.dto';
import { ReqContext } from '../shared/request-context/request-context.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard } from '../shared/guards/rbac.guard';
import { Roles } from '../shared/decorators/roles.decorator';
import { swaggerBaseApiResponse, BaseApiResponse } from '../shared/dtos/base-api-response.dto';
import { TaskService } from './task.service';
import { TaskInputDto } from './dto/task-input.dto';
import { TaskOutputDto } from './dto/task-output.dto';
import { TaskQueryDto } from './dto/task-query.dto';

@ApiTags('task')
@Controller('task')
@ApiExtraModels(TaskInputDto, TaskOutputDto, TaskQueryDto)
@UseGuards(JwtAuthGuard, RBACGuard)
@ApiBearerAuth()
@UseInterceptors(ClassSerializerInterceptor)
export class TaskController {
  constructor(
    private readonly taskService: TaskService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(TaskController.name);
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create Task' })
  @HttpCode(HttpStatus.CREATED)
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: swaggerBaseApiResponse(TaskOutputDto),
  })
  async create(
    @ReqContext() ctx: RequestContext,
    @Body() createTaskDto: TaskInputDto,
  ): Promise<BaseApiResponse<TaskOutputDto>> {
    const task = await this.taskService.create(ctx, createTaskDto);
    this.logger.log(ctx, `Created task with ID: ${task.id}`);
    return { data: task, meta: {} };
  }

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get Tasks List' })
  @HttpCode(HttpStatus.OK)
  @ApiResponse({
    status: HttpStatus.OK,
    type: swaggerBaseApiResponse([TaskOutputDto]),
  })
  async findAll(
    @ReqContext() ctx: RequestContext,
    @Query() query: TaskQueryDto,
  ): Promise<BaseApiResponse<TaskOutputDto[]>> {
    const tasks = await this.taskService.findAll(ctx, query);
    this.logger.log(ctx, `Found ${tasks.length} tasks`);
    return { data: tasks, meta: {} };
  }

  @Get('tutor/:tutorId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get Tasks by Tutor' })
  @HttpCode(HttpStatus.OK)
  @ApiResponse({
    status: HttpStatus.OK,
    type: swaggerBaseApiResponse([TaskOutputDto]),
  })
  async findByTutor(
    @ReqContext() ctx: RequestContext,
    @Param('tutorId') tutorId: number,
  ): Promise<BaseApiResponse<TaskOutputDto[]>> {
    const tasks = await this.taskService.findByTutor(ctx, tutorId);
    this.logger.log(ctx, `Found ${tasks.length} tasks for tutor ${tutorId}`);
    return { data: tasks, meta: {} };
  }

  @Get(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get Task by ID' })
  @HttpCode(HttpStatus.OK)
  @ApiResponse({
    status: HttpStatus.OK,
    type: swaggerBaseApiResponse(TaskOutputDto),
  })
  async findOne(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: number,
  ): Promise<BaseApiResponse<TaskOutputDto>> {
    const task = await this.taskService.findOne(ctx, id);
    this.logger.log(ctx, `Found task with ID: ${id}`);
    return { data: task, meta: {} };
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update Task' })
  @HttpCode(HttpStatus.OK)
  @ApiResponse({
    status: HttpStatus.OK,
    type: swaggerBaseApiResponse(TaskOutputDto),
  })
  async update(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: number,
    @Body() updateTaskDto: Partial<TaskInputDto>,
  ): Promise<BaseApiResponse<TaskOutputDto>> {
    const task = await this.taskService.update(ctx, id, updateTaskDto);
    this.logger.log(ctx, `Updated task with ID: ${id}`);
    return { data: task, meta: {} };
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete Task' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Task deleted successfully',
  })
  async remove(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: number,
  ): Promise<void> {
    await this.taskService.delete(ctx, id);
    this.logger.log(ctx, `Deleted task with ID: ${id}`);
  }
}
