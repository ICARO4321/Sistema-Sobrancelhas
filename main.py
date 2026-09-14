from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    Integer,
    Numeric,
    String,
    Text,
    create_engine,
    extract,
    func,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session, sessionmaker

DATABASE_URL = 'mysql+pymysql://root:1234@localhost:3306/bd_lala'

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

app = FastAPI(title='Sistema de Sobrancelhas API', version='1.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


# ==========================================
# MODELS
# ==========================================
class Usuario(Base):
  __tablename__ = 'usuarios'
  id = Column(Integer, primary_key=True, index=True)
  nome = Column(String(100), nullable=False)
  telefone = Column(String(20), nullable=False)
  email = Column(String(100), unique=True, nullable=False)
  senha = Column(String(255), nullable=False)
  tipo = Column(Enum('cliente', 'admin'), default='cliente')


class Servico(Base):
  __tablename__ = 'servicos'
  id = Column(Integer, primary_key=True, index=True)
  nome = Column(String(100), nullable=False)
  descricao = Column(Text)
  preco = Column(Numeric(10, 2), nullable=False)
  duracao_minutos = Column(Integer, nullable=False)


class Agendamento(Base):
  __tablename__ = 'agendamentos'
  id = Column(Integer, primary_key=True, index=True)
  cliente_id = Column(Integer, nullable=False)
  servico_id = Column(Integer, nullable=False)
  data_hora_inicio = Column(DateTime, nullable=False)
  data_hora_fim = Column(DateTime, nullable=False)
  status = Column(
      Enum('pendente', 'confirmado', 'cancelado', 'concluido'),
      default='confirmado',
  )


# ==========================================
# SCHEMAS (Pydantic)
# ==========================================
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
@app.get('/')
def root():
  return {'status': 'FastAPI rodando com sucesso!'}


# --- SERVIÇOS ---
@app.post('/api/servicos')
def criar_servico(
    servico: ServicoCreate, db: Session = Depends(get_db)
):
  novo_servico = Servico(**servico.dict())
  db.add(novo_servico)
  db.commit()
  db.refresh(novo_servico)
  return novo_servico


@app.get('/api/servicos')
def listar_servicos(db: Session = Depends(get_db)):
  return db.query(Servico).all()


# --- AGENDAMENTOS ---
@app.post('/api/agendamentos')
def criar_agendamento(
    dados: AgendamentoCreate, db: Session = Depends(get_db)
):
  servico = (
      db.query(Servico).filter(Servico.id == dados.servico_id).first()
  )
  if not servico:
    raise HTTPException(status_code=404, detail='Serviço não encontrado.')

  data_fim = dados.data_hora_inicio + timedelta(
      minutes=servico.duracao_minutos
  )

  # Verifica choque de horários
  conflito = (
      db.query(Agendamento)
      .filter(
          Agendamento.status != 'cancelado',
          Agendamento.data_hora_inicio < data_fim,
          Agendamento.data_hora_fim > dados.data_hora_inicio,
      )
      .first()
  )

  if conflito:
    raise HTTPException(
        status_code=400,
        detail='Horário indisponível! Escolha outro momento.',
    )

  novo_agendamento = Agendamento(
      cliente_id=dados.cliente_id,
      servico_id=dados.servico_id,
      data_hora_inicio=dados.data_hora_inicio,
      data_hora_fim=data_fim,
      status='confirmado',
  )
  db.add(novo_agendamento)
  db.commit()
  db.refresh(novo_agendamento)
  return novo_agendamento


@app.get('/api/agendamentos')
def listar_agendamentos(db: Session = Depends(get_db)):
  return db.query(Agendamento).all()


# --- PAINEL ADMIN ---
@app.get('/api/admin/faturamento')
def faturamento_mes(db: Session = Depends(get_db)):
  try:
    ano_atual = datetime.now().year
    mes_atual = datetime.now().month

    resultado = (
        db.query(func.sum(Servico.preco))
        .join(Agendamento, Agendamento.servico_id == Servico.id)
        .filter(
            extract('year', Agendamento.data_hora_inicio) == ano_atual,
            extract('month', Agendamento.data_hora_inicio) == mes_atual,
            Agendamento.status.in_(['confirmado', 'concluido']),
        )
        .scalar()
    )

    faturamento_total = float(resultado) if resultado else 0.0
    return {
        'mes': mes_atual,
        'ano': ano_atual,
        'faturamento_bruto': faturamento_total,
    }
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))