import assert from "node:assert/strict";
import { test } from "node:test";
import { CreateInterviewBody, GetInterviewResponse, SendInterviewVoiceTurnBody, SubmitInterviewAnswerBody } from "@workspace/api-zod";

const profile = {
  roleTitle: "معلم علوم",
  track: "education",
  experienceLevel: "mid",
  language: "ar",
  mode: "voice",
  questionCount: 20,
};

test("all professional tracks accept every length from 1 to 20", () => {
  const tracks = [
    "software", "industrial", "mechanical", "electrical", "electrical_technology",
    "electrical_trades", "electronics", "automation", "hvac", "automotive",
    "energy", "occupational_safety", "oil_gas", "agriculture", "civil",
    "healthcare", "education", "business", "finance", "sales", "hospitality",
    "logistics", "skilled_trades", "legal", "media", "science", "other",
  ];
  for (const track of tracks) {
    for (let questionCount = 1; questionCount <= 20; questionCount += 1) {
      assert.equal(CreateInterviewBody.safeParse({ ...profile, track, questionCount }).success, true);
    }
  }
});

test("new interviews reject counts outside 1–20 and unknown tracks", () => {
  for (const questionCount of [0, -1, 21, 15.5]) {
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

test("voice uploads can bind retries to their original question without breaking older clients", () => {
  assert.equal(SendInterviewVoiceTurnBody.safeParse({ audio: "AA==" }).success, true);
  for (const expectedQuestionNumber of [1, 5, 15, 20]) {
    const parsed = SendInterviewVoiceTurnBody.parse({ audio: "AA==", expectedQuestionNumber });
    assert.equal(parsed.expectedQuestionNumber, expectedQuestionNumber);
  }
  for (const expectedQuestionNumber of [0, 21, 1.5]) {
    assert.equal(SendInterviewVoiceTurnBody.safeParse({ audio: "AA==", expectedQuestionNumber }).success, false);
  }
});

test("camera snapshots are optional, JPEG-only data and bounded for text and voice answers", () => {
  const candidateImage = "data:image/jpeg;base64,/9j/2Q==";
  assert.equal(SubmitInterviewAnswerBody.parse({ answer: "A test answer", candidateImage }).candidateImage, candidateImage);
  assert.equal(SendInterviewVoiceTurnBody.parse({ audio: "AA==", candidateImage }).candidateImage, candidateImage);
  assert.equal(SubmitInterviewAnswerBody.safeParse({ answer: "No camera shared" }).success, true);
  for (const invalid of ["https://example.com/photo.jpg", "data:image/png;base64,AAAA", candidateImage + "\n", "data:image/jpeg;base64," + "A".repeat(1_000_000)]) {
    assert.equal(SubmitInterviewAnswerBody.safeParse({ answer: "Test", candidateImage: invalid }).success, false);
    assert.equal(SendInterviewVoiceTurnBody.safeParse({ audio: "AA==", candidateImage: invalid }).success, false);
  }
});
