// BI_CLIENT_QUESTIONS_v5
import { api } from "@/api/client";

export type Question = {
  questionKey: string;
  prompt: string;
  helpText: string | null;
  inputType: "yes_no" | "agree_disagree" | "text" | "textarea" | "number" | "date";
  group: string;
  adverseAnswer: string | null;
  required: boolean;
  dependsOnKey: string | null;
  dependsOnValue: string | null;
  sortOrder: number;
  askedBy: string[];
  value: string | null;
  reason: string | null;
};

export type QuestionSet = {
  applicationId: string;
  country: "CA" | "US";
  questions: Question[];
  outstanding?: number;
};

export type AnswerInput = { questionKey: string; value: string | null; reason?: string | null };

export function getQuestions(applicationId: string) {
  return api.get<QuestionSet>(`/applicants/applications/${encodeURIComponent(applicationId)}/questions`);
}

export function saveAnswers(applicationId: string, answers: AnswerInput[]) {
  return api.post<QuestionSet>(
    `/applicants/applications/${encodeURIComponent(applicationId)}/answers`,
    { answers },
  );
}
