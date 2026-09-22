const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'app', 'admin', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const target = `                  {isCreatingTwitchGiveaway ? "Criando..." : "Criar Sorteio Diário (Ao Vivo)"}
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === "users" && (`;

const replacement = `                  {isCreatingTwitchGiveaway ? "Criando..." : "Criar Sorteio Diário (Ao Vivo)"}
                </button>
              </form>
            </div>
            )}
          </div>
        )}

        {activeTab === "users" && (`;

content = content.replace(target, replacement);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Ternary fixed");
