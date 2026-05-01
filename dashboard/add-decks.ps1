$file = "c:\Users\Wesley\.gemini\antigravity\scratch\linguaflow\dashboard\dashboard.html"
$content = Get-Content $file -Raw

$deckSection = @"

        <!-- === DECKS === -->
        <section id="tab-decks" class="tab-content">
            <div class="header-area" style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <h1>🎴 Meus Decks</h1>
                    <p>Organize seu vocabulário em decks temáticos, igual ao Anki.</p>
                </div>
                <button id="btn-create-deck" class="btn-action btn-green">+ Novo Deck</button>
            </div>
            
            <div id="decks-list" class="decks-list" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(350px,1fr));gap:16px;margin-top:24px;">
                <div style="text-align:center;padding:40px;color:#94A3B8;grid-column:1/-1;">Carregando decks...</div>
            </div>
        </section>

"@

$content = $content -replace '(        <!-- === VOCABULÁRIO === -->)', "$deckSection`$1"
Set-Content $file -Value $content
Write-Host "Seção de Decks adicionada com sucesso!"
