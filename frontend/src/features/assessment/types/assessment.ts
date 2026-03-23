export interface Problem {
  id: string;
  title: string;
  description: string;
  templateCode: string;
}

export interface AssessmentState {
  code: string;
  problem: Problem | null;
}
