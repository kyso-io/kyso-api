NEXT_PUBLIC_API_URL=http://localhost:4000/v1 kyso-cli login --username palpatine@kyso.io --password n0tiene --provider kyso
NEXT_PUBLIC_API_URL=http://localhost:4000/v1 kyso-cli push -p ./test-reports/kronig-penney-exploration
NEXT_PUBLIC_API_URL=http://localhost:4000/v1 kyso-cli push -p ./test-reports/multiq-report
NEXT_PUBLIC_API_URL=http://localhost:4000/v1 kyso-cli push -p ./test-reports/markdown-report
NEXT_PUBLIC_API_URL=http://localhost:4000/v1 kyso-cli import-github-repository --name jupyter-samples
NEXT_PUBLIC_API_URL=http://localhost:4000/v1 kyso-cli import-github-repository --name Kalman-and-Bayesian-Filters-in-Python
NEXT_PUBLIC_API_URL=http://localhost:4000/v1 kyso-cli import-github-repository --name notebook-examples