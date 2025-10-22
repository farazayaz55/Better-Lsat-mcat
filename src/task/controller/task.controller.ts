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

import { AppLogger } from '../../shared/logger/logger.service';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { ReqContext } from '../../shared/request-context/req-context.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles } from '../../auth/decorators/role.decorator';
import {
  swaggerBaseApiResponse,
  BaseApiResponse,
} from '../../shared/dtos/base-api-response.dto';
import { TaskService } from '../service/task.service';
import { TaskInputDto } from '../dto/task-input.dto';
import { TaskOutputDto } from '../dto/task-output.dto';
import { TaskQueryDto } from '../dto/task-query.dto';
import { ROLE } from '../../auth/constants/role.constant';
import { RolesGuard } from '../../auth/guards/roles.guard';

@ApiTags('task')
@Controller('task')
@ApiExtraModels(TaskInputDto, TaskOutputDto, TaskQueryDto)
@UseGuards(JwtAuthGuard)
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
  @Roles(ROLE.ADMIN, ROLE.USER)
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @Roles(ROLE.ADMIN, ROLE.USER)
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
  @Roles(ROLE.ADMIN, ROLE.USER)
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
  @Roles(ROLE.ADMIN, ROLE.USER)
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
  @Roles(ROLE.ADMIN, ROLE.USER)
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
  @Roles(ROLE.ADMIN, ROLE.USER)
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
