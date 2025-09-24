
if __name__ == "__main__":
    from app.services.asrg_vuldb_service import ASRGVulnerabilityService
    result = ASRGVulnerabilityService.fetch_and_index("cve")
    print(result)
