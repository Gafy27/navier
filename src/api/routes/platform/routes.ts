import { z } from '../../../index.ts';
import {
  CheckKind,
  defineRoute,
  Method,
  RouteTag,
  WireType,
} from '../../adapter/route-types.ts';

export const getOpenApi = defineRoute({
  operationId: 'getOpenApi',
  summary: 'The OpenAPI document of this API',
  tag: RouteTag.enum.platform,
  errors: [WireType.enum.unauthenticated, WireType.enum.unavailable],
  method: Method.enum.GET,
  path: '/openapi.json',
  check: { kind: CheckKind.enum.caller },
  params: z.strictObject({}),
  response: z.record(z.string(), z.unknown()),
});

export const platformRoutes = { getOpenApi } as const;
