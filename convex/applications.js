import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// 전체 고객 목록 실시간 조회
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("applications").order("desc").collect();
  },
});

export const careHubSnapshot = query({
  args: {},
  handler: async (ctx) => {
    const [applications, assignments, claims, payouts, careLogs, faxRecords] = await Promise.all([
      ctx.db.query("applications").order("desc").collect(),
      ctx.db.query("assignments").collect(),
      ctx.db.query("claims").collect(),
      ctx.db.query("payouts").collect(),
      ctx.db.query("careLogs").collect(),
      ctx.db.query("faxRecords").order("desc").collect(),
    ]);

    return {
      status: "success",
      applications,
      assignments,
      claims,
      payouts,
      careLogs,
      faxRecords,
    };
  },
});

/* 
export const hyundaiClaimSnapshot = query({
  args: {},
  handler: async (ctx) => {
    const [applications, assignments, claims, faxRecords] = await Promise.all([
      ctx.db.query("applications").order("desc").collect(),
      ctx.db.query("assignments").collect(),
      ctx.db.query("claims").collect(),
      ctx.db.query("faxRecords").order("desc").collect(),
    ]);

    return {
      status: "success",
      applications,
      assignments,
      claims,
      faxRecords,
    };
  },
});
*/

export const getCustomerDetail = query({
  args: {
    appId: v.string(),
  },
  handler: async (ctx, args) => {
    const appId = args.appId.trim();
    if (!appId) return { status: "not_found" };

    const application = await ctx.db
      .query("applications")
      .withIndex("by_custom_id", (q) => q.eq("id", appId))
      .first();
    if (!application) return { status: "not_found" };

    const [assignments, claims, payouts, careLogs, faxRecords, samsungEmailLogs] = await Promise.all([
      ctx.db.query("assignments").withIndex("by_applyId", (q) => q.eq("applyId", appId)).collect(),
      ctx.db.query("claims").withIndex("by_applyId", (q) => q.eq("applyId", appId)).collect(),
      ctx.db.query("payouts").withIndex("by_applyId", (q) => q.eq("applyId", appId)).collect(),
      ctx.db.query("careLogs").withIndex("by_applyId", (q) => q.eq("applyId", appId)).collect(),
      ctx.db.query("faxRecords").filter((q) => q.eq(q.field("appId"), appId)).collect(),
      ctx.db.query("samsungEmailLogs").filter((q) => q.or(
        q.eq(q.field("appId"), appId),
        q.eq(q.field("targetAppId"), appId)
      )).collect(),
    ]);

    const adjusterNames = new Set([
      application.adjusterName,
      ...(Array.isArray(application.adjusterHistory) ? application.adjusterHistory.map((item) => item?.name) : []),
    ].filter(Boolean));
    const caregiverNames = new Set(assignments.map((item) => item.caregiverName).filter(Boolean));
    const centerNames = new Set(assignments.map((item) => item.centerName).filter(Boolean));
    const [adjusterGroups, caregiverGroups, centerGroups] = await Promise.all([
      Promise.all([...adjusterNames].map((name) => ctx.db.query("adjusters").withIndex("by_name", (q) => q.eq("name", name)).collect())),
      Promise.all([...caregiverNames].map((name) => ctx.db.query("caregivers").withIndex("by_name", (q) => q.eq("name", name)).collect())),
      Promise.all([...centerNames].map((name) => ctx.db.query("partners").withIndex("by_name", (q) => q.eq("name", name)).collect())),
    ]);

    return {
      status: "success",
      application,
      assignments,
      claims,
      payouts,
      careLogs,
      faxRecords,
      samsungEmailLogs,
      adjusters: adjusterGroups.flat(),
      caregivers: caregiverGroups.flat(),
      partners: centerGroups.flat(),
    };
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
