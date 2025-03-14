import { Prisma } from '@prisma/client';

export type GetMemberPayload = {
  select?: Prisma.MemberSelect;
  include?: Prisma.MemberInclude;
  omit?: Prisma.MemberOmit;
};

export type Member<S extends GetMemberPayload = Record<string, never>> =
  S['select'] extends undefined
    ? S['include'] extends undefined
      ? Prisma.MemberGetPayload<undefined>
      : S['omit'] extends undefined
        ? Prisma.MemberGetPayload<{ include: S['include'] }>
        : Prisma.MemberGetPayload<{ include: S['include']; omit: S['omit'] }>
    : S['omit'] extends undefined
      ? Prisma.MemberGetPayload<{ select: S['select'] }>
      : Prisma.MemberGetPayload<{ select: S['select']; omit: S['omit'] }>;

export type FindMember<
  Select extends Prisma.MemberSelect | undefined = undefined,
  Include extends Prisma.MemberInclude | undefined = undefined,
  PrismaOmit extends Prisma.MemberOmit | undefined = undefined,
> = Omit<
  Prisma.MemberFindFirstArgs,
  'select' | 'include' | 'omit' | 'where'
> & {
  select?: Select;
  include?: Include;
  omit?: PrismaOmit;
  where: Prisma.MemberWhereInput;
};
