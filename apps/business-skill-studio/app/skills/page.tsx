import { SkillLibrary } from '@/components/skill-library'

export const dynamic = 'force-dynamic'

export default function SkillsPage() {
  return (
    <main className="studio-stage library-stage">
      <header className="studio-topbar">
        <div className="topbar-inner">
          <div className="breadcrumb"><span>WinBrain</span><span>/</span><b>Skill 库</b></div>
          <div className="title-row">
            <div>
              <h1>Skill 库管理</h1>
              <p>集中查看、维护和校准团队沉淀的版本化 Skill。</p>
            </div>
            <div className="status-cluster">
              <span className="status-pill"><i />Skill Store</span>
              <span className="technology-pill">SKILL.md + evals</span>
            </div>
          </div>
        </div>
      </header>

      <SkillLibrary />
    </main>
  )
}
