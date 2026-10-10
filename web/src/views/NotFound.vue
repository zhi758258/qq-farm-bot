<template>
  <div class="not-found-page">
    <div class="not-found-card">
      <div class="code">
        404
      </div>
      <div class="title">
        Not Found
      </div>
    </div>
  </div>
</template>

<style scoped>
.not-found-page {
  min-height: 100vh;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
  color: #0f172a;
}

.dark .not-found-page {
  background: #020617;
  color: #e2e8f0;
}

.not-found-card {
  text-align: center;
}

.code {
  font-size: 4rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  line-height: 1;
}

.title {
  margin-top: 12px;
  font-size: 1.125rem;
  opacity: 0.6;
}
</style>
