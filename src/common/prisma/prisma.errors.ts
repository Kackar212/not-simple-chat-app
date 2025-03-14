import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

type Constr<T> = new (...args: any[]) => T;

interface ErrorMeta {
  message: string;
  code: CustomErrorCode;
}

export enum PrismaErrorCode {
  UniqueConstraintError = 'P2002',
  RecordNotFound = 'P2025',
  ForeignKeyConstraint = 'P2003',
}

export enum CustomErrorCode {
  UniqueConstraintError = 'ENTITY_ALREADY_EXISTS',
  RecordNotFound = 'NOT_FOUND',
  ForeignKeyConstraint = 'RELATED_ENTITY_MISSING',
}

function createError<T>(Exception: Constr<T>, meta: ErrorMeta) {
  return new Exception(meta);
}

type PrismaErrorFactory = {
  [key: string]: (meta: Record<string, unknown>) => HttpException;
};

export const PrismaError: PrismaErrorFactory = Object.freeze({
  [PrismaErrorCode.UniqueConstraintError]: (
    meta: Record<string, unknown>,
  ): ConflictException => {
    const error = {
      code: CustomErrorCode.UniqueConstraintError,
      message: 'Entity already exists',
      key: PrismaErrorCode.UniqueConstraintError,
      statusCode: HttpStatus.CONFLICT,
      meta,
    } as const;

    return createError(ConflictException, error);
  },
  [PrismaErrorCode.RecordNotFound]: (
    meta: Record<string, unknown>,
  ): BadRequestException => {
    const error = {
      code: CustomErrorCode.RecordNotFound,
      message: meta.cause as string,
      statusCode: HttpStatus.NOT_FOUND,
      meta,
    } as const;

    return createError(NotFoundException, error);
  },
  [PrismaErrorCode.ForeignKeyConstraint]: (meta: Record<string, unknown>) => {
    const error = {
      code: CustomErrorCode.RecordNotFound,
      message: meta.cause as string,
      statusCode: HttpStatus.NOT_FOUND,
      meta,
    } as const;

    return createError(NotFoundException, error);
  },
} as const);

export function getHttpException(error: unknown) {
  const isKnownError = error instanceof Prisma.PrismaClientKnownRequestError;

  if (typeof error === 'object' && error !== null && 'status' in error) {
    throw error;
  }

  if (!isKnownError) {
    throw error;
  }

  console.log(error);

  const createHttpException = PrismaError[error.code];
  return createHttpException?.(error.meta || {});
}
