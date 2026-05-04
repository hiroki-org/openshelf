with_retry() {
  local max_retries=3
  local count=0
  local wait=5
  while [ $count -lt $max_retries ]; do
    if "$@"; then
      return 0
    fi
    count=$((count + 1))
    echo "Command failed. Retrying in $wait seconds ($count/$max_retries)..." >&2
    sleep $wait
  done
  echo "Command failed after $max_retries attempts: $*" >&2
  return 1
}
