KYSO_API=https://dev.kyso.io/api/v1 kyso-cli login --username palpatine@kyso.io --password n0tiene --provider kyso
KYSO_API=https://dev.kyso.io/api/v1 kyso-cli push -p ./test-reports/kronig-penney-exploration
KYSO_API=https://dev.kyso.io/api/v1 kyso-cli push -p ./test-reports/multiq-report
KYSO_API=https://dev.kyso.io/api/v1 kyso-cli push -p ./test-reports/markdown-report
KYSO_API=https://dev.kyso.io/api/v1 kyso-cli import-github-repository --name jupyter-samples
KYSO_API=https://dev.kyso.io/api/v1 kyso-cli import-github-repository --name Kalman-and-Bayesian-Filters-in-Python
KYSO_API=https://dev.kyso.io/api/v1 kyso-cli import-github-repository --name notebook-examples