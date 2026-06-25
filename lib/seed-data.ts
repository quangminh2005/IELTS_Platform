export type Skill = "listening" | "reading" | "writing" | "speaking";
export type UnitType = "listening_part" | "reading_passage" | "writing_task" | "speaking_part";

export type DemoMaterial = {
  title: string;
  skill: Skill;
  sourceLabel: string;
  description: string;
  units: Array<{
    unitType: UnitType;
    unitNumber: number;
    title: string;
    instructions: string;
    content: string;
    audioUrl?: string;
    transcript?: string;
    defaultTimeLimitMinutes?: number;
    metadataJson?: string;
    questions: Array<{
      questionType: string;
      prompt: string;
      optionsJson?: string;
      correctAnswerJson?: string;
      explanation?: string;
      points?: number;
    }>;
  }>;
};

export const demoMaterials: DemoMaterial[] = [
  {
    title: "Reading: Urban Green Spaces",
    skill: "reading",
    sourceLabel: "Demo academic reading",
    description: "A short academic reading passage with a detail question.",
    units: [
      {
        unitType: "reading_passage",
        unitNumber: 1,
        title: "Passage 1",
        content:
          "Urban green spaces are increasingly viewed as essential infrastructure. Parks, tree-lined streets, and restored wetlands can reduce heat, support biodiversity, and improve residents' wellbeing when cities plan them as connected systems.",
        instructions: "Read the passage and answer the question.",
        defaultTimeLimitMinutes: 20,
        metadataJson: JSON.stringify({ section: 1, bandTarget: "5.5-7.0" }),
        questions: [
          {
            prompt: "According to the passage, what can connected green spaces reduce?",
            questionType: "short_answer",
            correctAnswerJson: JSON.stringify(["heat"]),
            explanation: "The passage says connected green spaces can reduce heat.",
            points: 1
          }
        ]
      }
    ]
  },
  {
    title: "Listening: Campus Orientation",
    skill: "listening",
    sourceLabel: "Demo listening transcript",
    description: "A demo listening part represented by transcript text.",
    units: [
      {
        unitType: "listening_part",
        unitNumber: 1,
        title: "Part 1",
        content: "Campus orientation conversation",
        transcript:
          "Advisor: The library tour starts at ten, but students should arrive fifteen minutes early to collect their access cards from reception.",
        instructions: "Listen to the conversation and answer the question.",
        defaultTimeLimitMinutes: 10,
        metadataJson: JSON.stringify({ speakers: 2, context: "campus" }),
        questions: [
          {
            prompt: "Where should students collect their access cards?",
            questionType: "short_answer",
            correctAnswerJson: JSON.stringify(["reception"]),
            explanation: "The advisor says access cards are collected from reception.",
            points: 1
          }
        ]
      }
    ]
  },
  {
    title: "Writing: Task 2 Education",
    skill: "writing",
    sourceLabel: "Demo writing prompt",
    description: "A demo IELTS Writing Task 2 prompt.",
    units: [
      {
        unitType: "writing_task",
        unitNumber: 2,
        title: "Task 2 Prompt",
        content:
          "Some people believe schools should focus mainly on academic subjects, while others think practical life skills are equally important. Discuss both views and give your own opinion.",
        instructions: "Write at least 250 words.",
        defaultTimeLimitMinutes: 40,
        metadataJson: JSON.stringify({ task: 2, minimumWords: 250 }),
        questions: []
      }
    ]
  },
  {
    title: "Speaking: Work and Study",
    skill: "speaking",
    sourceLabel: "Demo speaking prompts",
    description: "Demo speaking prompts for Part 1 practice.",
    units: [
      {
        unitType: "speaking_part",
        unitNumber: 1,
        title: "Part 1 Prompts",
        content:
          "Do you work or study? What do you enjoy most about it? How do you usually organize your day?",
        instructions: "Answer each prompt aloud in complete sentences.",
        defaultTimeLimitMinutes: 5,
        metadataJson: JSON.stringify({ part: 1, topic: "work and study" }),
        questions: []
      }
    ]
  }
];
