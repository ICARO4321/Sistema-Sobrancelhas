const API_URL = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
    ? 'http://127.0.0.1:8000/api'
    : 'https://sistema-sobrancelhas.onrender.com/api'; 

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('login-form')) {
        document.getElementById('login-form').addEventListener('submit', fazerLogin);
    }
    if (document.getElementById('cadastro-form')) {
        document.getElementById('cadastro-form').addEventListener('submit', cadastrarUsuario);
    }
    
    // TELA DO ADMIN
    if (document.getElementById('form-servico')) {
        verificarAcesso('admin');
        document.getElementById('form-servico').addEventListener('submit', cadastrarServico);
        
        // Novo: Agendamento Manual do Admin
        document.getElementById('form-agendamento-admin').addEventListener('submit', agendarManualmente);
        
        carregarDadosAdminAgendamento(); // Preenche os <selects> da Lala
        carregarAgenda();
        carregarFaturamento();
        carregarClientesHistorico(); 
    }

    // TELA DO CLIENTE
    if (document.getElementById('booking-form')) {
        verificarAcesso('cliente');
        configurarNomeCliente();
        carregarServicosCliente();
        document.getElementById('booking-form').addEventListener('submit', realizarAgendamento);
    }
});

// --- AUTENTICAÇÃO ---
async function fazerLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;
    const msg = document.getElementById('login-msg');

    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, senha })
        });
        if (res.ok) {
            const usuario = await res.json();
            localStorage.setItem('usuarioLogado', JSON.stringify(usuario));
            
            if (usuario.tipo === 'admin') window.location.href = 'admin.html';
            else window.location.href = 'cliente.html';
        } else {
            mostrarMensagem(msg, 'E-mail ou senha inválidos!', 'erro');
        }
    } catch (error) { mostrarMensagem(msg, 'Erro de conexão.', 'erro'); }
}

async function cadastrarUsuario(e) {
    e.preventDefault();
    const nome = document.getElementById('nome').value;
    const telefone = document.getElementById('telefone').value;
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;
    const msg = document.getElementById('cadastro-msg');

    try {
        const res = await fetch(`${API_URL}/usuarios`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, telefone, email, senha })
        });
        const data = await res.json();

        if (res.ok) {
            mostrarMensagem(msg, 'Conta criada! Redirecionando...', 'sucesso');
            setTimeout(() => { window.location.href = 'index.html'; }, 2000);
        } else {
            mostrarMensagem(msg, data.detail || 'Erro ao criar conta.', 'erro');
        }
    } catch (error) { mostrarMensagem(msg, 'Erro de conexão.', 'erro'); }
}

function fazerLogout() {
    localStorage.removeItem('usuarioLogado');
    window.location.href = 'index.html';
}

function verificarAcesso(tipoNecessario) {
    const user = JSON.parse(localStorage.getItem('usuarioLogado'));
    if (!user) {
        window.location.href = 'index.html';
    } else if (tipoNecessario === 'admin' && user.tipo !== 'admin') {
        alert('Acesso negado.');
        window.location.href = 'cliente.html';
    }
}

// --- PAINEL ADMIN ---
async function cadastrarServico(e) {
    e.preventDefault();
    const nome = document.getElementById('serv_nome').value;
    const preco = parseFloat(document.getElementById('serv_preco').value);
    const tempo = parseInt(document.getElementById('serv_tempo').value);
    const msg = document.getElementById('msg-servico');

    try {
        const res = await fetch(`${API_URL}/servicos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, preco, duracao_minutos: tempo, descricao: "" })
        });
        if (res.ok) {
            mostrarMensagem(msg, 'Serviço salvo!', 'sucesso');
            document.getElementById('form-servico').reset();
            carregarDadosAdminAgendamento(); // Atualiza a lista da caixinha ao lado
        } else {
            mostrarMensagem(msg, 'Erro ao salvar.', 'erro');
        }
    } catch (error) { mostrarMensagem(msg, 'Erro de conexão.', 'erro'); }
}

async function carregarDadosAdminAgendamento() {
    const selectCliente = document.getElementById('admin_cliente_id');
    const selectServico = document.getElementById('admin_servico_id');
    if (!selectCliente || !selectServico) return;

    try {
        const resCli = await fetch(`${API_URL}/clientes`);
        const clientes = await resCli.json();
        selectCliente.innerHTML = '<option value="" disabled selected>Escolha a cliente...</option>';
        clientes.forEach(c => { selectCliente.innerHTML += `<option value="${c.id}">${c.nome} (${c.telefone})</option>`; });

        const resServ = await fetch(`${API_URL}/servicos`);
        const servicos = await resServ.json();
        selectServico.innerHTML = '<option value="" disabled selected>Escolha o serviço...</option>';
        servicos.forEach(s => { selectServico.innerHTML += `<option value="${s.id}">${s.nome} - R$ ${s.preco.toFixed(2)}</option>`; });
    } catch (error) {
        console.error("Erro ao carregar selects do admin");
    }
}

async function agendarManualmente(e) {
    e.preventDefault();
    const clienteId = document.getElementById('admin_cliente_id').value;
    const servicoId = document.getElementById('admin_servico_id').value;
    const dataHora = document.getElementById('admin_data_hora').value;
    const msg = document.getElementById('msg-agendamento-admin');

    try {
        const response = await fetch(`${API_URL}/agendamentos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cliente_id: parseInt(clienteId), servico_id: parseInt(servicoId), data_hora_inicio: dataHora })
        });
        const data = await response.json();
        
        if (response.ok) {
            mostrarMensagem(msg, 'Horário marcado para a cliente!', 'sucesso');
            document.getElementById('form-agendamento-admin').reset();
            carregarAgenda();
            carregarFaturamento();
            carregarClientesHistorico();
        } else {
            mostrarMensagem(msg, data.detail || 'Erro ao agendar.', 'erro');
        }
    } catch (error) { mostrarMensagem(msg, 'Erro de conexão.', 'erro'); }
}

async function carregarAgenda() {
    const lista = document.getElementById('lista-agenda');
    if (!lista) return;

    try {
        const res = await fetch(`${API_URL}/agendamentos`);
        const agendamentos = await res.json();

        if (agendamentos.length === 0) {
            lista.innerHTML = '<p>Nenhum horário marcado ainda.</p>';
            return;
        }
        lista.innerHTML = '';
        agendamentos.forEach(ag => {
            const dataObj = new Date(ag.data_hora_inicio);
            const dataFormatada = dataObj.toLocaleDateString('pt-BR');
            const horaFormatada = dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            lista.innerHTML += `
                <div class="agenda-item">
                    <strong>Dia ${dataFormatada} às ${horaFormatada}</strong>
                    <p>Serviço ID: ${ag.servico_id} | Cliente ID: ${ag.cliente_id}</p>
                </div>
            `;
        });
    } catch (error) { lista.innerHTML = '<p>Erro ao carregar a agenda.</p>'; }
}

async function carregarFaturamento() {
    const elemFat = document.getElementById('faturamento-valor');
    if (!elemFat) return;
    try {
        const res = await fetch(`${API_URL}/admin/faturamento`);
        if (res.ok) {
            const data = await res.json();
            elemFat.textContent = `R$ ${data.faturamento_bruto.toFixed(2)}`;
        }
    } catch (error) { console.error('Erro:', error); }
}

async function carregarClientesHistorico() {
    const divClientes = document.getElementById('lista-clientes');
    if (!divClientes) return;

    try {
        const res = await fetch(`${API_URL}/admin/clientes`);
        const clientes = await res.json();

        if (clientes.length === 0) {
            divClientes.innerHTML = '<p>Nenhuma cliente cadastrada.</p>';
            return;
        }

        divClientes.innerHTML = '';
        clientes.forEach(c => {
            let linhas = '';
            if (c.historico.length > 0) {
                c.historico.forEach(hist => {
                    linhas += `
                        <tr>
                            <td>${hist.data} às ${hist.hora}</td>
                            <td>${hist.servico}</td>
                            <td>R$ ${hist.preco.toFixed(2)}</td>
                        </tr>
                    `;
                });
            } else {
                linhas = `<tr><td colspan="3" class="sem-servico">Nenhum serviço realizado ainda.</td></tr>`;
            }

            divClientes.innerHTML += `
                <div class="cliente-box">
                    <h4>
                        <span>${c.nome} <span class="telefone">${c.telefone}</span></span>
                        <span class="badge-total">Total: R$ ${c.total_gasto.toFixed(2)}</span>
                    </h4>
                    <table class="historico-tabela">
                        <thead>
                            <tr>
                                <th>Data/Hora</th>
                                <th>Serviço</th>
                                <th>Valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${linhas}
                        </tbody>
                    </table>
                </div>
            `;
        });
    } catch (error) {
        divClientes.innerHTML = '<p>Erro ao carregar o histórico de clientes.</p>';
    }
}

// --- PAINEL CLIENTE ---
function configurarNomeCliente() {
    const user = JSON.parse(localStorage.getItem('usuarioLogado'));
    if (user && user.nome && document.getElementById('bem-vindo-cliente')) {
        document.getElementById('bem-vindo-cliente').textContent = `Olá, ${user.nome}!`;
    }
}

async function carregarServicosCliente() {
    const container = document.getElementById('services-container');
    const select = document.getElementById('servico_id');
    if (!container || !select) return;

    try {
        const response = await fetch(`${API_URL}/servicos`);
        const servicos = await response.json();
        
        container.innerHTML = '';
        select.innerHTML = '<option value="" disabled selected>Selecione...</option>';

        if (servicos.length === 0) {
            container.innerHTML = '<p>Nenhum serviço cadastrado.</p>';
            return;
        }

        servicos.forEach(servico => {
            container.innerHTML += `
                <div class="service-card">
                    <h3>${servico.nome}</h3>
                    <div class="price">R$ ${parseFloat(servico.preco).toFixed(2)}</div>
                    <small>Duração: ${servico.duracao_minutos} min</small>
                </div>
            `;
            const option = document.createElement('option');
            option.value = servico.id;
            option.textContent = `${servico.nome} - R$ ${parseFloat(servico.preco).toFixed(2)}`;
            select.appendChild(option);
        });
    } catch (error) { container.innerHTML = '<p>Erro ao carregar serviços.</p>'; }
}

async function realizarAgendamento(event) {
    event.preventDefault();
    const user = JSON.parse(localStorage.getItem('usuarioLogado'));
    const servicoId = document.getElementById('servico_id').value;
    const dataHora = document.getElementById('data_hora').value;
    const msgDiv = document.getElementById('mensagem-retorno');

    try {
        const response = await fetch(`${API_URL}/agendamentos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cliente_id: user.id, servico_id: parseInt(servicoId), data_hora_inicio: dataHora })
        });
        const data = await response.json();
        
        if (response.ok) {
            mostrarMensagem(msgDiv, 'Horário agendado com sucesso!', 'sucesso');
            document.getElementById('booking-form').reset();
        } else {
            mostrarMensagem(msgDiv, data.detail || 'Erro ao agendar horário.', 'erro');
        }
    } catch (error) { mostrarMensagem(msgDiv, 'Erro de conexão.', 'erro'); }
}

// --- UTILITÁRIOS ---
function mostrarMensagem(elemento, texto, tipo) {
    if (!elemento) return;
    elemento.textContent = texto;
    elemento.className = `msg-box ${tipo}`;
    elemento.style.display = 'block';
    setTimeout(() => { elemento.style.display = 'none'; }, 4000);
}