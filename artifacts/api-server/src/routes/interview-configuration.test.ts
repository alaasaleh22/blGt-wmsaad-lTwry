import assert from "node:assert/strict";
import { test } from "node:test";
import { CreateInterviewBody, GetInterviewResponse } from "@workspace/api-zod";

const profile = {
  roleTitle: "معلم علوم",
  track: "education",
  experienceLevel: "mid",
  language: "ar",
  mode: "voice",
  questionCount: 20,
};

test("all professional tracks accept each new interview length", () => {
  const tracks = [
    "software", "industrial", "mechanical", "electrical", "civil",
    "healthcare", "education", "business", "finance", "sales", "hospitality",
    "logistics", "skilled_trades", "legal", "media", "science", "other",
  ];
  for (const track of tracks) {
    for (let questionCount = 15; questionCount <= 20; questionCount += 1) {
      assert.equal(CreateInterviewBody.safeParse({ ...profile, track, questionCount }).success, true);
    }
  }
});

test("new interviews reject counts outside 15–20 and unknown tracks", () => {
  for (const questionCount of [3, 5, 14, 21, 15.5]) {
    assert.equal(CreateInterviewBody.safeParse({ ...profile, questionCount }).success, false);
  }
  assert.equal(CreateInterviewBody.safeParse({ ...profile, track: "unknown" }).success, false);
});

test("old three- and five-question sessions remain readable", () => {
  for (const questionCount of [3, 5]) {
    assert.equal(GetInterviewResponse.safeParse({
      session: {
        ...profile,
        id: "487c78cc-167f-4a9d-878b-adcdd3574809",
        questionCount,
        turnNumber: 1,
        status: "active",
        currentQuestion: "عرّفني بخبرتك المهنية.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        evaluation: null,
      },
      turns: [],
    }).success, true);
  }
});
