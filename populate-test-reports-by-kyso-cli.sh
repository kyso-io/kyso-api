KYSO_API=http://localhost:4000/v1 kyso-cli login --username palpatine@kyso.io --password n0tiene --provider kyso
KYSO_API=http://localhost:4000/v1 kyso-cli push -p ./test-reports/kronig-penney-exploration
KYSO_API=http://localhost:4000/v1 kyso-cli push -p ./test-reports/multiq-report
KYSO_API=http://localhost:4000/v1 kyso-cli push -p ./test-reports/markdown-report