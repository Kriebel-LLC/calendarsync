#!/bin/bash

# Function to print an error message and exit with a failure code
die() {
    echo "$1" >&2
    exit 1
}

# Check the number of command line arguments
if [ "$#" -ne 1 ]; then
    die "Usage: $0 <staging|production>"
fi

# Map the parameter to the corresponding branch
case $1 in
    "staging")
        branch_name="main"
        ;;
    "production")
        branch_name="production"
        ;;
    *)
        die "Invalid parameter. Please use 'staging' or 'production'."
        ;;
esac

# Check if the current branch is the specified branch
current_branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$current_branch" != "$branch_name" ]; then
    die "Error: You must be on the '$branch_name' branch."
fi

# Check if there are unstaged changes
if [[ $(git status -s) ]]; then
    die "Error: There are unstaged changes. Please commit or stash your changes before running the precommit script."
fi

# Check if there are unpushed changes
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/$branch_name)" ]; then
    die "Error: There are unpushed changes on your '$branch_name' branch. Please push your changes to the remote."
fi


# For production branch, check if local is up to date with remote
if [ "$1" == "production" ]; then
    if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/$branch_name)" ]; then
        die "Error: Your local 'production' branch is not up to date with the remote. Please pull the latest changes. If you are trying to rollback, do so from the Cloudflare Dashboard."
    fi
fi

# Run 'yarn precommit'
yarn precommit

# Run 'wrangler deploy'
if [ "$1" == "staging" ]; then
    wrangler deploy --keep-vars --env staging
elif [ "$1" == "production" ]; then
    wrangler deploy --keep-vars --env production
else
    die "Invalid parameter. Please use 'staging' or 'production'."
fi
