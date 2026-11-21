import { Goal, Plan, Planning, PROMPT_VERSION, rejectSensitive } from "./types";
export function planGoal(goal: Goal): Planning {
  rejectSensitive([goal.purpose, goal.audience, goal.topic].join(" "));
  const objective =
    goal.objective ??
    (/集客|来場|来店/.test(goal.purpose)
      ? "visits"
      : /購入|売上|購買/.test(goal.purpose)
        ? "sales"
        : /認知|知名度/.test(goal.purpose)
          ? "awareness"
          : undefined);
  const region =
    goal.region ||
    (/都内|東京|銀座/.test(goal.purpose)
      ? "東京"
      : /大阪/.test(goal.purpose)
        ? "大阪"
        : /全国/.test(goal.purpose)
          ? "全国"
          : "");
  const topic =
    goal.topic ||
    (/スケート/.test(goal.purpose)
      ? "スケート"
      : /犬|ドッグ/.test(goal.purpose)
        ? "犬"
        : /グルメ|レストラン/.test(goal.purpose)
          ? "グルメ"
          : /旅行/.test(goal.purpose)
            ? "旅行"
            : "");
  const audience =
    goal.audience ||
    [
      /カップル/.test(goal.purpose) ? "カップル" : "",
      /子連れ|親子|子育て/.test(goal.purpose) ? "子育て世帯" : "",
    ]
      .filter(Boolean)
      .join("・");
  const questions: Planning["questions"] = [];
  if (!objective)
    questions.push({
      field: "objective",
      text: "この案件は、認知拡大・来場や来店・購入のどれを最も重視しますか？",
    });
  if (!audience)
    questions.push({
      field: "audience",
      text: "どんな人に届けたいですか？（例：都内のカップル、子育て世帯）",
    });
  if (!region)
    questions.push({
      field: "region",
      text: "対象エリアを教えてください。地域を限定しない場合は「全国」と入力してください。",
    });
  if (!topic)
    questions.push({
      field: "topic",
      text: "PRする商品・体験のジャンルを教えてください。（例：スケート、グルメ）",
    });
  if (questions.length) return { questions, plan: null, provider: "mock" };
  const tags = [...goal.targetTags];
  if (/カップル/.test(audience) && !tags.includes("カップル"))
    tags.push("カップル");
  if (/子連れ|子育て|親子/.test(audience) && !tags.includes("子持ち"))
    tags.push("子持ち");
  if (/犬/.test(audience) && !tags.includes("犬好き")) tags.push("犬好き");
  const normalized = {
    ...goal,
    objective: objective!,
    region,
    topic,
    audience,
    targetTags: tags,
  };
  const criteria: Plan["criteria"] = [];
  if (tags.length)
    criteria.push({
      id: "audience",
      label: "届けたい層への到達",
      weight: 40,
      target: 0.5,
    });
  if (/スケート|犬/.test(topic))
    criteria.push({
      id: "interest",
      label: "案件テーマへの関心",
      weight: 35,
      target: 0.3,
    });
  if (goal.ages.length)
    criteria.push({
      id: "age",
      label: "対象年代への到達",
      weight: 25,
      target: 0.6,
    });
  const sum = criteria.reduce((n, c) => n + c.weight, 0);
  let allocated = 0;
  criteria.forEach((c, i) => {
    c.weight =
      i === criteria.length - 1
        ? 100 - allocated
        : Math.round((c.weight / sum) * 100);
    allocated += c.weight;
  });
  return {
    questions: [],
    provider: "mock",
    plan: {
      goal: normalized,
      summary: `${region}で${audience}に${topic}の魅力を届け、${objective === "visits" ? "来場・来店" : objective === "sales" ? "購入" : "認知拡大"}につなげる`,
      queries: [
        ...new Set([
          `${topic} ${region === "全国" ? "" : region}`.trim(),
          `${topic} ${audience}`.slice(0, 100),
        ]),
      ],
      criteria,
      recommendThreshold: 60,
      version: PROMPT_VERSION,
    },
  };
}
