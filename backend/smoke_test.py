"""Credential-free smoke test for the lightweight RAG core."""
from app.rag.knowledge_base import knowledge_base


def main() -> None:
    stats = knowledge_base.stats()
    assert stats["knowledge_documents"] >= 9, stats
    assert stats["knowledge_chunks"] > 0, stats

    checks = {
        "KYC verification requirements": "Kyc",
        "AML escalation indicators": "Aml",
        "credit risk borrower assessment": "Credit Risk",
    }
    for query, expected in checks.items():
        results = knowledge_base.search(query, top_k=3)
        assert results, f"No results for {query}"
        assert expected.lower() in results[0]["document"].lower(), (query, results[0]["document"])

    runtime = knowledge_base.add_upload(
        "employee_loan_demo.txt",
        b"Employee Loan Policy\n\nEligibility\nEmployees with twelve months of service may apply for the internal employee loan program.",
    )
    try:
        results = knowledge_base.search("employee loan eligibility", top_k=3)
        assert results and "Employee Loan Demo" in results[0]["document"], results
    finally:
        knowledge_base.delete_runtime(runtime["id"])

    print("CloudFin RAG smoke test: PASS")
    print(knowledge_base.stats())


if __name__ == "__main__":
    main()
