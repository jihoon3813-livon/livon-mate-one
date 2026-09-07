import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// 전체 고객 목록 실시간 조회
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("applications").order("desc").collect();
  },
});

// 신규 고객 신청 등록
export const create = mutation({
  args: {
    data: v.any(),
  },
  handler: async (ctx, args) => {
    const { _id, _creationTime, ...doc } = args.data;
    return await ctx.db.insert("applications", doc);
  },
});

// 고객 정보 업데이트 (메모, 상태, 손사 정보 등)
export const update = mutation({
  args: {
    id: v.id("applications"),
    patch: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, args.patch);
  },
});

// 고객 삭제
export const remove = mutation({
  args: {
    id: v.id("applications"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
