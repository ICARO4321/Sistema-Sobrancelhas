import os
from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import (
    Column,
    DateTime,
    Integer,
    Numeric,
    String,
    Text,
    create_engine,
    extract,
    func,
    desc
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session, sessionmaker

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://neondb_owner:npg_84WmRSDQCaNK@ep-cool-dust-b55vvptg-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require"
)

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

app = FastAPI(title="Sistema Lala Sobrancelhas", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# MODELS
# ==========================================
class Usuario(Base):
    __tablename__ = "usuarios"
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(100), nullable=False)
    telefone = Column(String(20), nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    senha = Column(String(255), nullable=False)
    tipo = Column(String(20), default="cliente")

class Servico(Base):
    __tablename__ = "servicos"
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(100), nullable=False)
    descricao = Column(Text)
    preco = Column(Numeric(10, 2), nullable=False)
    duracao_minutos = Column(Integer, nullable=False)

class Agendamento(Base):
    __tablename__ = "agendamentos"
    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, nullable=False)
    servico_id = Column(Integer, nullable=False)
    data_hora_inicio = Column(DateTime, nullable=False)
    data_hora_fim = Column(DateTime, nullable=False)
    status = Column(String(20), default="confirmado")

# ==========================================
# SCHEMAS
# ==========================================
class LoginRequest(BaseModel):
    email: str
    senha: str

class UsuarioCreate(BaseModel):
    nome: str
    telefone: str
    email: str
    senha: str

class ServicoCreate(BaseModel):
    nome: str
    descricao: Optional[str] = None
    preco: float
    duracao_minutos: int

class AgendamentoCreate(BaseModel):
    cliente_id: int
    servico_id: int
    data_hora_inicio: datetime

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ==========================================
# ROTAS DA API
# ==========================================
@app.get("/")
def root():
    return {"status": "FastAPI rodando com sucesso no NeonDB!"}

@app.post("/api/login")
def fazer_login(dados: LoginRequest, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.email == dados.email).first()
    if not usuario or usuario.senha != dados.senha:
        raise HTTPException(status_code=401, detail="Email ou senha incorretos.")
    return {"id": usuario.id, "nome": usuario.nome, "tipo": usuario.tipo}

@app.post("/api/usuarios")
def criar_usuario(usuario: UsuarioCreate, db: Session = Depends(get_db)):
    db_user = db.query(Usuario).filter(Usuario.email == usuario.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="E-mail já cadastrado.")
    
    novo_usuario = Usuario(
        nome=usuario.nome,
        telefone=usuario.telefone,
        email=usuario.email,
        senha=usuario.senha,
        tipo="cliente"
    )
    db.add(novo_usuario)
    db.commit()
    db.refresh(novo_usuario)
    return {"mensagem": "Usuário criado com sucesso!"}

@app.get("/api/clientes")
def listar_clientes_simples(db: Session = Depends(get_db)):
    clientes = db.query(Usuario).filter(Usuario.tipo == "cliente").all()
    return [{"id": c.id, "nome": c.nome, "telefone": c.telefone} for c in clientes]

@app.post("/api/servicos")
def criar_servico(servico: ServicoCreate, db: Session = Depends(get_db)):
    novo_servico = Servico(**servico.dict())
    db.add(novo_servico)
    db.commit()
    db.refresh(novo_servico)
    return novo_servico

@app.get("/api/servicos")
def listar_servicos(db: Session = Depends(get_db)):
    return db.query(Servico).all()

@app.post("/api/agendamentos")
def criar_agendamento(dados: AgendamentoCreate, db: Session = Depends(get_db)):
    servico = db.query(Servico).filter(Servico.id == dados.servico_id).first()
    if not servico:
        raise HTTPException(status_code=404, detail="Serviço não encontrado.")

    data_fim = dados.data_hora_inicio + timedelta(minutes=servico.duracao_minutos)
    conflito = (
        db.query(Agendamento)
        .filter(
            Agendamento.status != "cancelado",
            Agendamento.data_hora_inicio < data_fim,
            Agendamento.data_hora_fim > dados.data_hora_inicio,
        )
        .first()
    )

    if conflito:
        raise HTTPException(status_code=400, detail="Horário indisponível! Escolha outro momento.")

    novo_agendamento = Agendamento(
        cliente_id=dados.cliente_id,
        servico_id=dados.servico_id,
        data_hora_inicio=dados.data_hora_inicio,
        data_hora_fim=data_fim,
        status="confirmado",
    )
    db.add(novo_agendamento)
    db.commit()
    db.refresh(novo_agendamento)
    return novo_agendamento

@app.get("/api/agendamentos")
def listar_agendamentos(db: Session = Depends(get_db)):
    return db.query(Agendamento).order_by(Agendamento.data_hora_inicio).all()

@app.get("/api/admin/faturamento")
def faturamento_mes(db: Session = Depends(get_db)):
    try:
        ano_atual = datetime.now().year
        mes_atual = datetime.now().month
        resultado = (
            db.query(func.sum(Servico.preco))
            .join(Agendamento, Agendamento.servico_id == Servico.id)
            .filter(
                extract("year", Agendamento.data_hora_inicio) == ano_atual,
                extract("month", Agendamento.data_hora_inicio) == mes_atual,
                Agendamento.status.in_(["confirmado", "concluido"]),
            )
            .scalar()
        )
        return {"mes": mes_atual, "ano": ano_atual, "faturamento_bruto": float(resultado) if resultado else 0.0}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/clientes")
def listar_clientes_historico(db: Session = Depends(get_db)):
    clientes = db.query(Usuario).filter(Usuario.tipo == "cliente").all()
    resultado = []
    
    for c in clientes:
        historico = (
            db.query(Agendamento, Servico)
            .join(Servico, Agendamento.servico_id == Servico.id)
            .filter(Agendamento.cliente_id == c.id)
            .order_by(desc(Agendamento.data_hora_inicio))
            .all()
        )
        
        lista_hist = []
        for ag, serv in historico:
            lista_hist.append({
                "data": ag.data_hora_inicio.strftime("%d/%m/%Y"),
                "hora": ag.data_hora_inicio.strftime("%H:%M"),
                "servico": serv.nome,
                "preco": float(serv.preco)
            })
        
        total_gasto = sum(item["preco"] for item in lista_hist)
        
        resultado.append({
            "id": c.id,
            "nome": c.nome,
            "telefone": c.telefone,
            "total_gasto": total_gasto,
            "historico": lista_hist
        })
        
    return resultado