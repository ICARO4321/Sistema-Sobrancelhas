// Alterna dinamicamente entre o backend local e o backend do Render
const API_URL = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
    ? 'http://127.0.0.1:8000/api'
    : 'https://sistema-sobrancelhas-api.onrender.com/api'; // Substitua pelo seu link do Render depois do deploy

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('login-form')) {
        document.getElementById('login-form').addEventListener('submit', fazerLogin);
    }

    if (document.getElementById('cadastro-form')) {
        document.getElementById('cadastro-form').addEventListener('submit', cadastrarUsuario);
    }
    
    if (document.getElementById('form-servico')) {
        verificarAcesso('admin');
        document.getElementById('form-servico').addEventListener('submit', cadastrarServico);
        carregarAgenda();
    }

    if (document.getElementById('booking-form')) {
        verificarAcesso('cliente');
        configurarNomeCliente();
        carregarServicosCliente();
        document.getElementById('booking-form').addEventListener('submit', realizarAgendamento);
    }
});

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
            
            if (usuario.tipo === 'admin') {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'cliente.html';
            }
        } else {
            mostrarMensagem(msg, 'E-mail ou senha inválidos!', 'erro');
        }
    } catch (error) {
        mostrarMensagem(msg, 'Erro ao conectar ao servidor.', 'erro');
    }
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
            mostrarMensagem(msg, 'Conta criada com sucesso! Redirecionando...', 'sucesso');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        } else {
            mostrarMensagem(msg, data.detail || 'Erro ao criar conta.', 'erro');
        }
    } catch (error) {
        mostrarMensagem(msg, 'Erro de conexão com o servidor.', 'erro');
    }
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
        alert('Acesso negado. Área restrita.');
        window.location.href = 'cliente.html';
    }
}

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
            mostrarMensagem(msg, 'Serviço cadastrado com sucesso!', 'sucesso');
            document.getElementById('form-servico').reset();
        } else {
            mostrarMensagem(msg, 'Erro ao cadastrar.', 'erro');
        }
    } catch (error) {
        mostrarMensagem(msg, 'Erro de conexão.', 'erro');
    }
}

async function carregarAgenda() {
    const lista = document.getElementById('lista-agenda');
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
                    <strong>Dia ${dataFormatada} às ${horaFormatada}</strong><br>
                    Serviço ID: ${ag.servico_id} | Cliente ID: ${ag.cliente_id} | Status: ${ag.status}
                </div>
            `;
        });
    } catch (error) {
        lista.innerHTML = '<p>Erro ao carregar a agenda.</p>';
    }
}

function configurarNomeCliente() {
    const user = JSON.parse(localStorage.getItem('usuarioLogado'));
    if (user && user.nome) {
        document.getElementById('bem-vindo-cliente').textContent = `Olá, ${user.nome}!`;
    }
}

async function carregarServicosCliente() {
    try {
        const response = await fetch(`${API_URL}/servicos`);
        const servicos = await response.json();
        const container = document.getElementById('services-container');
        const select = document.getElementById('servico_id');
        
        container.innerHTML = '';
        if (servicos.length === 0) {
            container.innerHTML = '<p>Nenhum serviço disponível no momento.</p>';
            return;
        }

        servicos.forEach(servico => {
            const card = document.createElement('div');
            card.className = 'service-card';
            card.innerHTML = `
                <h3>${servico.nome}</h3>
                <div class="price">R$ ${servico.preco.toFixed(2)}</div>
                <small>Duração: ${servico.duracao_minutos} min</small>
            `;
            container.appendChild(card);

            const option = document.createElement('option');
            option.value = servico.id;
            option.textContent = `${servico.nome} - R$ ${servico.preco.toFixed(2)}`;
            select.appendChild(option);
        });
    } catch (error) {
        document.getElementById('services-container').innerHTML = '<p>Erro ao carregar os serviços.</p>';
    }
}

async function realizarAgendamento(event) {
    event.preventDefault();
    const user = JSON.parse(localStorage.getItem('usuarioLogado'));
    const servicoId = document.getElementById('servico_id').value;
    const dataHora = document.getElementById('data_hora').value;
    const msgDiv = document.getElementById('mensagem-retorno');

    const payload = {
        cliente_id: user.id, 
        servico_id: parseInt(servicoId),
        data_hora_inicio: dataHora
    };

    try {
        const response = await fetch(`${API_URL}/agendamentos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (response.ok) {
            mostrarMensagem(msgDiv, 'Horário agendado com sucesso!', 'sucesso');
            document.getElementById('booking-form').reset();
        } else {
            mostrarMensagem(msgDiv, data.detail || 'Erro ao agendar horário.', 'erro');
        }
    } catch (error) {
        mostrarMensagem(msgDiv, 'Erro de conexão com o servidor.', 'erro');
    }
}

function mostrarMensagem(elemento, texto, tipo) {
    elemento.textContent = texto;
    elemento.className = `msg-box ${tipo}`;
    elemento.style.display = 'block';
    setTimeout(() => { elemento.style.display = 'none'; }, 4000);
}