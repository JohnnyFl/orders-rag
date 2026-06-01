import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

# Disable LangSmith tracing for this scoring script
os.environ["LANGCHAIN_TRACING_V2"] = "false"
os.environ["LANGSMITH_TRACING"] = "false"

from openai import OpenAI
from ragas.llms import llm_factory
from ragas.embeddings import embedding_factory
from ragas.metrics.collections import (
    IDBasedContextPrecision, IDBasedContextRecall,
    Faithfulness, ResponseRelevancy,
)
from ragas.dataset_schema import SingleTurnSample


def main():
    if len(sys.argv) < 2:
        sys.exit("usage: eval_ragas.py <raw.jsonl>")
    raw_path = Path(sys.argv[1])
    scored_path = raw_path.with_name(raw_path.stem.replace("_raw", "") + "_scored.jsonl")

    client = OpenAI()
    llm = llm_factory("gpt-4.1-mini", client=client)
    emb = embedding_factory("openai", model="text-embedding-3-small", client=client)
    P = IDBasedContextPrecision()
    R = IDBasedContextRecall()
    F = Faithfulness(llm=llm)
    Rel = ResponseRelevancy(llm=llm, embeddings=emb)

    rows = [json.loads(l) for l in raw_path.read_text().splitlines() if l.strip()]
    with scored_path.open("w") as out:
        for i, row in enumerate(rows):
            if row["kind"] == "retrieval" and row.get("expected_doc_ids"):
                s = SingleTurnSample(
                    retrieved_context_ids=row["retrieved"],
                    reference_context_ids=row["expected_doc_ids"],
                )
                row["precision"] = P.single_turn_score(s)
                row["recall"]    = R.single_turn_score(s)

                s2 = SingleTurnSample(
                    user_input=row["question"],
                    response=row["answer"],
                    retrieved_contexts=row["contexts"],
                )
                try:
                    row["faithfulness"] = F.single_turn_score(s2)
                except Exception as e:
                    row["faithfulness_error"] = str(e)
                try:
                    row["relevancy"] = Rel.single_turn_score(s2)
                except Exception as e:
                    row["relevancy_error"] = str(e)
            out.write(json.dumps(row) + "\n")
            if (i + 1) % 10 == 0:
                print(f"  scored {i+1}/{len(rows)}")
    print(f"Wrote {scored_path}")


if __name__ == "__main__":
    main()