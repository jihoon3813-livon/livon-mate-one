import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// 1. 전체 실시간 데이터 번들 조회 (사이트 로딩용 초고속 원클릭 쿼리)
export const bundleAll = query({
  args: {},
  handler: async (ctx) => {
    const [applications, assignments, claims, payouts, adjusters, careLogs] = await Promise.all([
      ctx.db.query("applications").order("desc").collect(),
      ctx.db.query("assignments").collect(),
      ctx.db.query("claims").collect(),
      ctx.db.query("payouts").collect(),
      ctx.db.query("adjusters").collect(),
      ctx.db.query("careLogs").collect(),
    ]);
    return { applications, assignments, claims, payouts, adjusters, careLogs };
  },
});

// 2. 고객 신청 등록 및 수정 (Upsert by id)
export const saveApplication = mutation({
  args: {
    app: v.any(),
  },
  handler: async (ctx, args) => {
    const { _id, _creationTime, ...doc } = args.app;
    if (!doc.id) {
      return await ctx.db.insert("applications", doc);
    }
    const existing = await ctx.db
      .query("applications")
      .filter((q) => q.eq(q.field("id"), doc.id))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, doc);
      return existing._id;
    } else {
      return await ctx.db.insert("applications", doc);
    }
  },
});

// 3. 고객 및 연계 데이터 삭제
export const deleteApplication = mutation({
  args: {
    appId: v.string(),
  },
  handler: async (ctx, args) => {
    const apps = await ctx.db
      .query("applications")
      .filter((q) => q.eq(q.field("id"), args.appId))
      .collect();
    for (const a of apps) {
      await ctx.db.delete(a._id);
    }

    // 연관 배정, 청구, 지급도 함께 정리
    const assigns = await ctx.db
      .query("assignments")
      .filter((q) => q.eq(q.field("applyId"), args.appId))
      .collect();
    for (const as of assigns) await ctx.db.delete(as._id);

    const claims = await ctx.db
      .query("claims")
      .filter((q) => q.eq(q.field("applyId"), args.appId))
      .collect();
    for (const c of claims) await ctx.db.delete(c._id);

    const payouts = await ctx.db
      .query("payouts")
      .filter((q) => q.eq(q.field("applyId"), args.appId))
      .collect();
    for (const p of payouts) await ctx.db.delete(p._id);

    return { deletedAppId: args.appId, count: apps.length };
  },
});

// 4. 배정 등록 및 갱신
export const saveAssignment = mutation({
  args: {
    assign: v.any(),
  },
  handler: async (ctx, args) => {
    const { _id, _creationTime, ...doc } = args.assign;
    if (doc.id) {
      const existing = await ctx.db
        .query("assignments")
        .filter((q) => q.eq(q.field("id"), doc.id))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, doc);
        return existing._id;
      }
    }
    return await ctx.db.insert("assignments", doc);
  },
});

// 5. 청구 등록 및 갱신 (수납대사 등)
export const saveClaim = mutation({
  args: {
    claim: v.any(),
  },
  handler: async (ctx, args) => {
    const { _id, _creationTime, ...doc } = args.claim;
    if (doc.id) {
      const existing = await ctx.db
        .query("claims")
        .filter((q) => q.eq(q.field("id"), doc.id))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, doc);
        return existing._id;
      }
    }
    return await ctx.db.insert("claims", doc);
  },
});

// 6. 간병비 지급 정산 갱신
export const savePayout = mutation({
  args: {
    payout: v.any(),
  },
  handler: async (ctx, args) => {
    const { _id, _creationTime, ...doc } = args.payout;
    if (doc.id) {
      const existing = await ctx.db
        .query("payouts")
        .filter((q) => q.eq(q.field("id"), doc.id))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, doc);
        return existing._id;
      }
    }
    return await ctx.db.insert("payouts", doc);
  },
});

// 7. 메모 단독 수정
export const updateMemo = mutation({
  args: {
    appId: v.string(),
    memo: v.string(),
  },
  handler: async (ctx, args) => {
    const app = await ctx.db
      .query("applications")
      .filter((q) => q.eq(q.field("id"), args.appId))
      .first();
    if (app) {
      await ctx.db.patch(app._id, { memo: args.memo, updatedAt: new Date().toISOString() });
    }
  },
});

// 8. 청구 단독 삭제
export const deleteClaim = mutation({
  args: {
    claimId: v.string(),
  },
  handler: async (ctx, args) => {
    const claims = await ctx.db
      .query("claims")
      .filter((q) => q.eq(q.field("id"), args.claimId))
      .collect();
    for (const c of claims) {
      await ctx.db.delete(c._id);
    }
    return { deletedClaimId: args.claimId, count: claims.length };
  },
});

// 9. 지급 정산 단독 삭제
export const deletePayout = mutation({
  args: {
    payoutId: v.string(),
  },
  handler: async (ctx, args) => {
    const payouts = await ctx.db
      .query("payouts")
      .filter((q) => q.eq(q.field("id"), args.payoutId))
      .collect();
    for (const p of payouts) {
      await ctx.db.delete(p._id);
    }
    return { deletedPayoutId: args.payoutId, count: payouts.length };
  },
});

