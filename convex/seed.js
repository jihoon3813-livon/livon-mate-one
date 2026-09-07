import { mutation } from "./_generated/server";
import { v } from "convex/values";

// 일괄 데이터 주입 (Batch Seed)
export const seedBatch = mutation({
  args: {
    table: v.string(),
    items: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    let count = 0;
    for (const item of args.items) {
      // _id 필드가 혹시 들어있으면 충돌 방지를 위해 제거
      const { _id, _creationTime, ...doc } = item;
      await ctx.db.insert(args.table, doc);
      count++;
    }
    return { table: args.table, inserted: count };
  },
});

// 테이블 비우기 (초기화용)
export const clearTable = mutation({
  args: {
    table: v.string(),
  },
  handler: async (ctx, args) => {
    const records = await ctx.db.query(args.table).take(500);
    for (const rec of records) {
      await ctx.db.delete(rec._id);
    }
    return { table: args.table, deleted: records.length };
  },
});
