import { DEFAULT_LOCALE, type Locale } from "./locales";

/**
 * Mensagens das server actions (avisos de sucesso/erro no topo das páginas).
 * Ficam indexadas pelo texto em português para não precisar de uma chave em
 * cada `redirect`. Texto fora do mapa cai no próprio português.
 */
type Vars = Record<string, string | number>;

const en: Record<string, string> = {
  "Ação inválida.": "Invalid action.",
  "Apenas quem administra o servidor pode mexer nos salários.": "Only server managers can change salaries.",
  "Clã aliado inválido ou sem permissão para editar o servidor.":
    "Invalid allied clan or no permission to edit the server.",
  "Clã ou servidor inválido.": "Invalid clan or server.",
  "Coeficiente inválido.": "Invalid coefficient.",
  "Coeficientes e poderes mínimos atualizados.": "Coefficients and minimum power updated.",
  "Cor inválida.": "Invalid color.",
  "Dados do jogador atualizados.": "Player data updated.",
  "Data de fim inválida.": "Invalid end date.",
  "Divisão da pedra inválida.": "Invalid stone split.",
  "Doação atualizada.": "Donation updated.",
  "Encontro inválido ou sem permissão para removê-lo.": "Invalid encounter or no permission to remove it.",
  "Encontro removido junto com as presenças dele.": "Encounter removed along with its attendance.",
  "Escolha clãs diferentes para mesclar.": "Pick different clans to merge.",
  "Essa guerra já está encerrada.": "That war is already closed.",
  "Esse usuário já existe.": "That username already exists.",
  "Este personagem ainda não está ligado a um jogador.": "This character is not linked to a player yet.",
  "Guerra encerrada.": "War closed.",
  "Guerra iniciada. O tempo está sendo contado.": "War started. Time is being counted.",
  "Guerra não encontrada.": "War not found.",
  "Guerra registrada e encerrada.": "War recorded and closed.",
  "Há um prêmio inválido na seleção.": "There is an invalid prize in the selection.",
  "Informe o início da guerra.": "Enter the war start.",
  "Informe o início e o fim da semana.": "Enter the week start and end.",
  "Informe o nome de exibição.": "Enter the display name.",
  "Informe o nome do lançamento.": "Enter the entry name.",
  "Informe o nome do personagem.": "Enter the character name.",
  "Informe um nome de time com pelo menos 2 caracteres.": "Enter a team name with at least 2 characters.",
  "Informe um poder válido.": "Enter a valid power.",
  "Informe um valor válido.": "Enter a valid amount.",
  "Já existe outro personagem com esse nome no servidor.":
    "Another character with that name already exists on the server.",
  "Já existe um personagem com esse nome neste servidor.":
    "A character with that name already exists on this server.",
  "Já existe um time com esse nome neste servidor.": "A team with that name already exists on this server.",
  "Já existe uma semana começando nesse dia.": "A week starting on that day already exists.",
  "Jogador não encontrado neste servidor.": "Player not found on this server.",
  "Jogador não está no elenco desta semana.": "The player is not in this week's roster.",
  "Jogador removido do elenco.": "Player removed from the roster.",
  "Lançamento não encontrado.": "Entry not found.",
  "Membro inválido para este clã.": "Invalid member for this clan.",
  "Não foi possível criar a semana.": "Could not create the week.",
  "Não foi possível criar o time.": "Could not create the team.",
  "Não foi possível criar o usuário.": "Could not create the user.",
  "Não foi possível cadastrar o personagem.": "Could not create the character.",
  "Não foi possível salvar o time do personagem.": "Could not save the character's team.",
  "Não foi possível salvar.": "Could not save.",
  "Nenhum jogador novo para adicionar.": "No new player to add.",
  "Nenhum servidor com dono definido.": "No server with an owner set.",
  "Nenhum servidor está com a sincronização ativada.": "No server has sync enabled.",
  "O fim precisa ser depois do início.": "The end must be after the start.",
  "O início da guerra está no futuro. Ajuste o registro.": "The war start is in the future. Fix the record.",
  "O nome não pode ficar vazio.": "The name cannot be empty.",
  "O time escolhido não pertence a este servidor.": "The chosen team does not belong to this server.",
  "Pagamento do jogador atualizado.": "Player payment updated.",
  "Papel inválido.": "Invalid role.",
  "Percentual inválido.": "Invalid percentage.",
  "Perfil atualizado.": "Profile updated.",
  "Personagem cadastrado manualmente.": "Character created manually.",
  "Personagem não encontrado.": "Character not found.",
  "Postura inválida.": "Invalid stance.",
  "Precisa existir pelo menos um administrador ativo.": "There must be at least one active administrator.",
  "Preferência inválida.": "Invalid preference.",
  "Produção vai nos três espaços de vale; aqui entram só custos.":
    "Production goes in the three vale slots; only costs go here.",
  "Registro de guerra removido.": "War record removed.",
  "Seleção de presenças inválida.": "Invalid attendance selection.",
  "Seleção inválida.": "Invalid selection.",
  "Selecione ao menos um jogador.": "Select at least one player.",
  "Selecione dois clãs válidos.": "Select two valid clans.",
  "Sem permissão de edição neste servidor.": "No edit permission on this server.",
  "Sem permissão para alterar este registro.": "No permission to change this record.",
  "Sem permissão para criar times neste servidor.": "No permission to create teams on this server.",
  "Sem permissão para definir a postura dos clãs neste servidor.":
    "No permission to set clan stances on this server.",
  "Sem permissão para definir este servidor casa.": "No permission to set this home server.",
  "Sem permissão para editar times neste servidor.": "No permission to edit teams on this server.",
  "Sem permissão para remover times neste servidor.": "No permission to remove teams on this server.",
  "Sem permissão para vincular clãs a times neste servidor.":
    "No permission to link clans to teams on this server.",
  "Sem permissão para vincular jogadores aos clãs neste servidor.":
    "No permission to link players to clans on this server.",
  "Semana não encontrada.": "Week not found.",
  "Senha redefinida. Sessões antigas foram encerradas.": "Password reset. Old sessions were ended.",
  "Servidor da guerra inválido ou sem acesso.": "Invalid war server or no access.",
  "Servidor inválido ou sem permissão de edição.": "Invalid server or no edit permission.",
  "Servidor inválido ou sem permissão para administrá-lo.": "Invalid server or no permission to manage it.",
  "Servidor inválido ou sem permissão para distribuir o prêmio.":
    "Invalid server or no permission to distribute the prize.",
  "Servidor inválido ou sem permissão para marcar presenças.":
    "Invalid server or no permission to mark attendance.",
  "Servidor inválido ou sem permissão para registrar encontros.":
    "Invalid server or no permission to record encounters.",
  "Servidor inválido.": "Invalid server.",
  "Servidor não encontrado.": "Server not found.",
  "Time inválido.": "Invalid team.",
  "Tipo de guerra inválido.": "Invalid war type.",
  "Usuário desativado.": "User disabled.",
  "Usuário deve ter de 3 a 32 caracteres: letras, números, ponto, hífen ou _.":
    "The username must be 3–32 characters: letters, numbers, dot, hyphen or _.",
  "Usuário não encontrado.": "User not found.",
  "Usuário reativado.": "User reactivated.",
  "Vale inválido.": "Invalid vale.",
  "Você não pode alterar o seu próprio papel.": "You cannot change your own role.",
  "Você não pode desativar o seu próprio usuário.": "You cannot disable your own user.",
  "Acessos removidos. O usuário não verá nenhum servidor.":
    "Access removed. The user will see no server.",
  "A seleção inclui um encontro que não é desta semana do servidor.":
    "The selection includes an encounter that is not from this server's week.",
  "A seleção inclui um jogador que não é dos clãs aliados deste servidor.":
    "The selection includes a player that is not from this server's allied clans.",
  "A seleção inclui um membro que não é dos clãs aliados deste servidor.":
    "The selection includes a member that is not from this server's allied clans.",
  "Cada membro só pode receber um baú de cada raridade.":
    "Each member can receive only one chest of each rarity.",
  "Informe um horário válido (HH:MM) para o encontro.": "Enter a valid time (HH:MM) for the encounter.",
  "Informe uma data válida para o encontro.": "Enter a valid date for the encounter.",
  "A senha precisa ter pelo menos 8 caracteres.": "The password must be at least 8 characters.",
  "A senha é longa demais.": "The password is too long.",
  "Plano de {clan} salvo.": "{clan}'s plan saved.",
  "{clan}: postura removida.": "{clan}: stance removed.",
  "{clan}: {stance}.": "{clan}: {stance}.",
  "{player} não está em {clan}.": "{player} is not in {clan}.",
  "{player} saiu de {clan}.": "{player} left {clan}.",
  "{player} já está em {clan}.": "{player} is already in {clan}.",
  "{player} vinculado a {clan}.": "{player} linked to {clan}.",
  "{clan} agora está em {team}.": "{clan} is now in {team}.",
  "{clan} sem time.": "{clan} without a team.",
  "Usuário {username} criado. Defina os servidores liberados abaixo.":
    "User {username} created. Set the granted servers below.",
  "Custo lançado: {name}.": "Cost added: {name}.",
  "{vale} limpo.": "{vale} cleared.",
  "{vale} salvo.": "{vale} saved.",
  "Lançamento removido: {name}.": "Entry removed: {name}.",
  "Time {name} criado.": "Team {name} created.",
  "Time {name} atualizado.": "Team {name} updated.",
  "Time {team} removido.": "Team {team} removed.",
  "Servidor casa definido: {server}.": "Home server set: {server}.",
  "Encontro de {date} às {time} registrado.": "Encounter on {date} at {time} recorded.",
  "{source} agora é tratado como {target}: {count} personagem(ns) reapontado(s).":
    "{source} is now treated as {target}: characters repointed: {count}.",
  "Servidores liberados: {count}.": "Granted servers: {count}.",
  "Servidores com dono definido: {count}.": "Servers with an owner set: {count}.",
  "Jogadores adicionados ao elenco: {count}.": "Players added to the roster: {count}.",
  "Aliados adicionados ao elenco: {count}.": "Allies added to the roster: {count}.",
  "Semana criada com {count} jogadores dos clãs aliados no elenco.":
    "Week created with {count} allied players in the roster.",
  "Semana criada. Nenhum jogador aliado encontrado para o elenco.":
    "Week created. No allied player found for the roster.",
  "Semana removida com produção, custos e elenco.": "Week removed with production, costs and roster.",
  "{label}: sincronização ativada.": "{label}: sync enabled.",
  "{label}: sincronização desativada.": "{label}: sync disabled.",
  "Servidores com falha: {failed}. {detail}": "Servers failed: {failed}. {detail}",
  "Informe o valor do {vale}.": "Enter the {vale} amount.",
  "Coeficiente da faixa {tier} inválido.": "Invalid coefficient for tier {tier}.",
  "Poder mínimo da faixa {tier} inválido.": "Invalid minimum power for tier {tier}.",
  "Baú de {month} salvo: {chests} baú(s) para {members} membro(s).":
    "Chests for {month} saved: chests {chests} · members {members}.",
  "falha ao sincronizar.": "sync failed.",
  "ranking vazio.": "empty ranking.",
  "{label}: {read} jogadores lidos, {created} novos, {updated} atualizados.":
    "{label}: {read} players read, {created} new, {updated} updated.",
  "Servidores sincronizados: {count} · novos: {created} · atualizados: {updated}.":
    "Servers synced: {count} · new: {created} · updated: {updated}.",
  "Selecione um jogador do ranking geral do jogo.": "Select a player from the game's overall ranking.",
  "Jogador não encontrado no ranking geral do jogo.": "Player not found in the game's overall ranking.",
  "Esse jogador é deste servidor: marque a presença dele na tabela acima.":
    "That player belongs to this server: mark their attendance in the table above.",
  "Esse jogador já está no bloco custom.": "That player is already in the custom block.",
  "Não foi possível adicionar o membro.": "Could not add the member.",
  "Servidor inválido ou sem permissão para montar o bloco custom.":
    "Invalid server or no permission to build the custom block.",
  "Sem permissão para mexer no bloco custom deste servidor.":
    "No permission to change this server's custom block.",
  "Membro inválido ou sem permissão para removê-lo.": "Invalid member or no permission to remove it.",
  "Membro removido do bloco custom junto com as presenças dele.":
    "Member removed from the custom block along with their attendance.",
  "{name} entrou no bloco custom.": "{name} joined the custom block.",
  "Presenças do bloco custom salvas: {marks} em {fights} encontro(s).":
    "Custom block attendance saved: {marks} in {fights} encounter(s).",
  "A seleção inclui um membro que não está no bloco custom deste servidor.":
    "The selection includes a member that is not in this server's custom block.",
  "Pagamento do jogador marcado como pago.": "Player payment marked as paid.",
  "Pagamento do jogador marcado como pendente.": "Player payment marked as pending.",
  "Membro inválido.": "Invalid member.",
  "Membro não tem baú neste mês.": "The member has no chest this month.",
  "Baús de {name} marcados como entregues.": "{name}'s chests marked as delivered.",
  "Entrega dos baús de {name} desmarcada.": "{name}'s chest delivery unmarked.",
  "Escolha um membro de outro clã aliado.": "Pick a member from another allied clan.",
  "Esse membro não é convidado deste plano.": "That member is not a guest of this plan.",
  "{name} entrou na CE de {clan} como convidado.": "{name} joined {clan}'s CE as a guest.",
  "Convidado removido da CE de {clan}.": "Guest removed from {clan}'s CE.",
};

const es: Record<string, string> = {
  "Ação inválida.": "Acción inválida.",
  "Apenas quem administra o servidor pode mexer nos salários.":
    "Solo quien administra el servidor puede tocar los salarios.",
  "Clã aliado inválido ou sem permissão para editar o servidor.":
    "Clan aliado inválido o sin permiso para editar el servidor.",
  "Clã ou servidor inválido.": "Clan o servidor inválido.",
  "Coeficiente inválido.": "Coeficiente inválido.",
  "Coeficientes e poderes mínimos atualizados.": "Coeficientes y poderes mínimos actualizados.",
  "Cor inválida.": "Color inválido.",
  "Dados do jogador atualizados.": "Datos del jugador actualizados.",
  "Data de fim inválida.": "Fecha de fin inválida.",
  "Divisão da pedra inválida.": "División de la piedra inválida.",
  "Doação atualizada.": "Donación actualizada.",
  "Encontro inválido ou sem permissão para removê-lo.": "Encuentro inválido o sin permiso para eliminarlo.",
  "Encontro removido junto com as presenças dele.": "Encuentro eliminado junto con sus presencias.",
  "Escolha clãs diferentes para mesclar.": "Elige clanes diferentes para fusionar.",
  "Essa guerra já está encerrada.": "Esa guerra ya está finalizada.",
  "Esse usuário já existe.": "Ese usuario ya existe.",
  "Este personagem ainda não está ligado a um jogador.":
    "Este personaje aún no está vinculado a un jugador.",
  "Guerra encerrada.": "Guerra finalizada.",
  "Guerra iniciada. O tempo está sendo contado.": "Guerra iniciada. El tiempo se está contando.",
  "Guerra não encontrada.": "Guerra no encontrada.",
  "Guerra registrada e encerrada.": "Guerra registrada y finalizada.",
  "Há um prêmio inválido na seleção.": "Hay un premio inválido en la selección.",
  "Informe o início da guerra.": "Indica el inicio de la guerra.",
  "Informe o início e o fim da semana.": "Indica el inicio y el fin de la semana.",
  "Informe o nome de exibição.": "Indica el nombre visible.",
  "Informe o nome do lançamento.": "Indica el nombre del registro.",
  "Informe o nome do personagem.": "Indica el nombre del personaje.",
  "Informe um nome de time com pelo menos 2 caracteres.":
    "Indica un nombre de equipo de al menos 2 caracteres.",
  "Informe um poder válido.": "Indica un poder válido.",
  "Informe um valor válido.": "Indica un valor válido.",
  "Já existe outro personagem com esse nome no servidor.":
    "Ya existe otro personaje con ese nombre en el servidor.",
  "Já existe um personagem com esse nome neste servidor.":
    "Ya existe un personaje con ese nombre en este servidor.",
  "Já existe um time com esse nome neste servidor.": "Ya existe un equipo con ese nombre en este servidor.",
  "Já existe uma semana começando nesse dia.": "Ya existe una semana que empieza ese día.",
  "Jogador não encontrado neste servidor.": "Jugador no encontrado en este servidor.",
  "Jogador não está no elenco desta semana.": "El jugador no está en la plantilla de esta semana.",
  "Jogador removido do elenco.": "Jugador quitado de la plantilla.",
  "Lançamento não encontrado.": "Registro no encontrado.",
  "Membro inválido para este clã.": "Miembro inválido para este clan.",
  "Não foi possível criar a semana.": "No se pudo crear la semana.",
  "Não foi possível criar o time.": "No se pudo crear el equipo.",
  "Não foi possível criar o usuário.": "No se pudo crear el usuario.",
  "Não foi possível cadastrar o personagem.": "No se pudo registrar el personaje.",
  "Não foi possível salvar o time do personagem.": "No se pudo guardar el equipo del personaje.",
  "Não foi possível salvar.": "No se pudo guardar.",
  "Nenhum jogador novo para adicionar.": "Ningún jugador nuevo para añadir.",
  "Nenhum servidor com dono definido.": "Ningún servidor con dueño definido.",
  "Nenhum servidor está com a sincronização ativada.": "Ningún servidor tiene la sincronización activada.",
  "O fim precisa ser depois do início.": "El fin debe ser posterior al inicio.",
  "O início da guerra está no futuro. Ajuste o registro.":
    "El inicio de la guerra está en el futuro. Ajusta el registro.",
  "O nome não pode ficar vazio.": "El nombre no puede quedar vacío.",
  "O time escolhido não pertence a este servidor.": "El equipo elegido no pertenece a este servidor.",
  "Pagamento do jogador atualizado.": "Pago del jugador actualizado.",
  "Papel inválido.": "Rol inválido.",
  "Percentual inválido.": "Porcentaje inválido.",
  "Perfil atualizado.": "Perfil actualizado.",
  "Personagem cadastrado manualmente.": "Personaje registrado manualmente.",
  "Personagem não encontrado.": "Personaje no encontrado.",
  "Postura inválida.": "Postura inválida.",
  "Precisa existir pelo menos um administrador ativo.":
    "Debe existir al menos un administrador activo.",
  "Preferência inválida.": "Preferencia inválida.",
  "Produção vai nos três espaços de vale; aqui entram só custos.":
    "La producción va en los tres huecos de valle; aquí solo entran costes.",
  "Registro de guerra removido.": "Registro de guerra eliminado.",
  "Seleção de presenças inválida.": "Selección de presencias inválida.",
  "Seleção inválida.": "Selección inválida.",
  "Selecione ao menos um jogador.": "Selecciona al menos un jugador.",
  "Selecione dois clãs válidos.": "Selecciona dos clanes válidos.",
  "Sem permissão de edição neste servidor.": "Sin permiso de edición en este servidor.",
  "Sem permissão para alterar este registro.": "Sin permiso para cambiar este registro.",
  "Sem permissão para criar times neste servidor.": "Sin permiso para crear equipos en este servidor.",
  "Sem permissão para definir a postura dos clãs neste servidor.":
    "Sin permiso para definir la postura de los clanes en este servidor.",
  "Sem permissão para definir este servidor casa.": "Sin permiso para definir este servidor casa.",
  "Sem permissão para editar times neste servidor.": "Sin permiso para editar equipos en este servidor.",
  "Sem permissão para remover times neste servidor.": "Sin permiso para eliminar equipos en este servidor.",
  "Sem permissão para vincular clãs a times neste servidor.":
    "Sin permiso para vincular clanes a equipos en este servidor.",
  "Sem permissão para vincular jogadores aos clãs neste servidor.":
    "Sin permiso para vincular jugadores a los clanes en este servidor.",
  "Semana não encontrada.": "Semana no encontrada.",
  "Senha redefinida. Sessões antigas foram encerradas.":
    "Contraseña restablecida. Las sesiones antiguas se cerraron.",
  "Servidor da guerra inválido ou sem acesso.": "Servidor de la guerra inválido o sin acceso.",
  "Servidor inválido ou sem permissão de edição.": "Servidor inválido o sin permiso de edición.",
  "Servidor inválido ou sem permissão para administrá-lo.":
    "Servidor inválido o sin permiso para administrarlo.",
  "Servidor inválido ou sem permissão para distribuir o prêmio.":
    "Servidor inválido o sin permiso para repartir el premio.",
  "Servidor inválido ou sem permissão para marcar presenças.":
    "Servidor inválido o sin permiso para marcar presencias.",
  "Servidor inválido ou sem permissão para registrar encontros.":
    "Servidor inválido o sin permiso para registrar encuentros.",
  "Servidor inválido.": "Servidor inválido.",
  "Servidor não encontrado.": "Servidor no encontrado.",
  "Time inválido.": "Equipo inválido.",
  "Tipo de guerra inválido.": "Tipo de guerra inválido.",
  "Usuário desativado.": "Usuario desactivado.",
  "Usuário deve ter de 3 a 32 caracteres: letras, números, ponto, hífen ou _.":
    "El usuario debe tener de 3 a 32 caracteres: letras, números, punto, guion o _.",
  "Usuário não encontrado.": "Usuario no encontrado.",
  "Usuário reativado.": "Usuario reactivado.",
  "Vale inválido.": "Valle inválido.",
  "Você não pode alterar o seu próprio papel.": "No puedes cambiar tu propio rol.",
  "Você não pode desativar o seu próprio usuário.": "No puedes desactivar tu propio usuario.",
  "Acessos removidos. O usuário não verá nenhum servidor.":
    "Accesos eliminados. El usuario no verá ningún servidor.",
  "A seleção inclui um encontro que não é desta semana do servidor.":
    "La selección incluye un encuentro que no es de esta semana del servidor.",
  "A seleção inclui um jogador que não é dos clãs aliados deste servidor.":
    "La selección incluye un jugador que no es de los clanes aliados de este servidor.",
  "A seleção inclui um membro que não é dos clãs aliados deste servidor.":
    "La selección incluye un miembro que no es de los clanes aliados de este servidor.",
  "Cada membro só pode receber um baú de cada raridade.":
    "Cada miembro solo puede recibir un cofre de cada rareza.",
  "Informe um horário válido (HH:MM) para o encontro.": "Indica una hora válida (HH:MM) para el encuentro.",
  "Informe uma data válida para o encontro.": "Indica una fecha válida para el encuentro.",
  "A senha precisa ter pelo menos 8 caracteres.": "La contraseña debe tener al menos 8 caracteres.",
  "A senha é longa demais.": "La contraseña es demasiado larga.",
  "Plano de {clan} salvo.": "Plan de {clan} guardado.",
  "{clan}: postura removida.": "{clan}: postura quitada.",
  "{clan}: {stance}.": "{clan}: {stance}.",
  "{player} não está em {clan}.": "{player} no está en {clan}.",
  "{player} saiu de {clan}.": "{player} salió de {clan}.",
  "{player} já está em {clan}.": "{player} ya está en {clan}.",
  "{player} vinculado a {clan}.": "{player} vinculado a {clan}.",
  "{clan} agora está em {team}.": "{clan} ahora está en {team}.",
  "{clan} sem time.": "{clan} sin equipo.",
  "Usuário {username} criado. Defina os servidores liberados abaixo.":
    "Usuario {username} creado. Define los servidores liberados abajo.",
  "Custo lançado: {name}.": "Coste registrado: {name}.",
  "{vale} limpo.": "{vale} limpiado.",
  "{vale} salvo.": "{vale} guardado.",
  "Lançamento removido: {name}.": "Registro eliminado: {name}.",
  "Time {name} criado.": "Equipo {name} creado.",
  "Time {name} atualizado.": "Equipo {name} actualizado.",
  "Time {team} removido.": "Equipo {team} eliminado.",
  "Servidor casa definido: {server}.": "Servidor casa definido: {server}.",
  "Encontro de {date} às {time} registrado.": "Encuentro del {date} a las {time} registrado.",
  "{source} agora é tratado como {target}: {count} personagem(ns) reapontado(s).":
    "{source} ahora se trata como {target}: personajes reasignados: {count}.",
  "Servidores liberados: {count}.": "Servidores liberados: {count}.",
  "Servidores com dono definido: {count}.": "Servidores con dueño definido: {count}.",
  "Jogadores adicionados ao elenco: {count}.": "Jugadores añadidos a la plantilla: {count}.",
  "Aliados adicionados ao elenco: {count}.": "Aliados añadidos a la plantilla: {count}.",
  "Semana criada com {count} jogadores dos clãs aliados no elenco.":
    "Semana creada con {count} jugadores de los clanes aliados en la plantilla.",
  "Semana criada. Nenhum jogador aliado encontrado para o elenco.":
    "Semana creada. Ningún jugador aliado encontrado para la plantilla.",
  "Semana removida com produção, custos e elenco.": "Semana eliminada con producción, costes y plantilla.",
  "{label}: sincronização ativada.": "{label}: sincronización activada.",
  "{label}: sincronização desativada.": "{label}: sincronización desactivada.",
  "Servidores com falha: {failed}. {detail}": "Servidores con fallo: {failed}. {detail}",
  "Informe o valor do {vale}.": "Indica el valor del {vale}.",
  "Coeficiente da faixa {tier} inválido.": "Coeficiente inválido para la franja {tier}.",
  "Poder mínimo da faixa {tier} inválido.": "Poder mínimo inválido para la franja {tier}.",
  "Baú de {month} salvo: {chests} baú(s) para {members} membro(s).":
    "Cofres de {month} guardados: cofres {chests} · miembros {members}.",
  "falha ao sincronizar.": "fallo al sincronizar.",
  "ranking vazio.": "ranking vacío.",
  "{label}: {read} jogadores lidos, {created} novos, {updated} atualizados.":
    "{label}: {read} jugadores leídos, {created} nuevos, {updated} actualizados.",
  "Servidores sincronizados: {count} · novos: {created} · atualizados: {updated}.":
    "Servidores sincronizados: {count} · nuevos: {created} · actualizados: {updated}.",
  "Selecione um jogador do ranking geral do jogo.":
    "Selecciona un jugador de la clasificación general del juego.",
  "Jogador não encontrado no ranking geral do jogo.":
    "Jugador no encontrado en la clasificación general del juego.",
  "Esse jogador é deste servidor: marque a presença dele na tabela acima.":
    "Ese jugador es de este servidor: marca su presencia en la tabla de arriba.",
  "Esse jogador já está no bloco custom.": "Ese jugador ya está en el bloque custom.",
  "Não foi possível adicionar o membro.": "No fue posible añadir al miembro.",
  "Servidor inválido ou sem permissão para montar o bloco custom.":
    "Servidor inválido o sin permiso para armar el bloque custom.",
  "Sem permissão para mexer no bloco custom deste servidor.":
    "Sin permiso para tocar el bloque custom de este servidor.",
  "Membro inválido ou sem permissão para removê-lo.": "Miembro inválido o sin permiso para quitarlo.",
  "Membro removido do bloco custom junto com as presenças dele.":
    "Miembro quitado del bloque custom junto con sus presencias.",
  "{name} entrou no bloco custom.": "{name} entró en el bloque custom.",
  "Presenças do bloco custom salvas: {marks} em {fights} encontro(s).":
    "Presencias del bloque custom guardadas: {marks} en {fights} encuentro(s).",
  "A seleção inclui um membro que não está no bloco custom deste servidor.":
    "La selección incluye un miembro que no está en el bloque custom de este servidor.",
  "Pagamento do jogador marcado como pago.": "Pago del jugador marcado como pagado.",
  "Pagamento do jogador marcado como pendente.": "Pago del jugador marcado como pendiente.",
  "Membro inválido.": "Miembro inválido.",
  "Membro não tem baú neste mês.": "El miembro no tiene cofre este mes.",
  "Baús de {name} marcados como entregues.": "Cofres de {name} marcados como entregados.",
  "Entrega dos baús de {name} desmarcada.": "Entrega de los cofres de {name} desmarcada.",
  "Escolha um membro de outro clã aliado.": "Elige un miembro de otro clan aliado.",
  "Esse membro não é convidado deste plano.": "Ese miembro no es invitado de este plan.",
  "{name} entrou na CE de {clan} como convidado.": "{name} entró en la CE de {clan} como invitado.",
  "Convidado removido da CE de {clan}.": "Invitado eliminado de la CE de {clan}.",
};

const ko: Record<string, string> = {
  "Ação inválida.": "잘못된 작업입니다.",
  "Apenas quem administra o servidor pode mexer nos salários.":
    "서버 관리자만 급여를 수정할 수 있습니다.",
  "Clã aliado inválido ou sem permissão para editar o servidor.":
    "동맹 클랜이 잘못되었거나 서버 편집 권한이 없습니다.",
  "Clã ou servidor inválido.": "클랜 또는 서버가 잘못되었습니다.",
  "Coeficiente inválido.": "계수가 잘못되었습니다.",
  "Coeficientes e poderes mínimos atualizados.": "계수와 최소 전투력이 업데이트되었습니다.",
  "Cor inválida.": "색상이 잘못되었습니다.",
  "Dados do jogador atualizados.": "플레이어 정보가 업데이트되었습니다.",
  "Data de fim inválida.": "종료 시간이 잘못되었습니다.",
  "Divisão da pedra inválida.": "돌 분배 설정이 잘못되었습니다.",
  "Doação atualizada.": "기부가 업데이트되었습니다.",
  "Encontro inválido ou sem permissão para removê-lo.":
    "일정이 잘못되었거나 삭제 권한이 없습니다.",
  "Encontro removido junto com as presenças dele.": "일정과 참석 기록이 삭제되었습니다.",
  "Escolha clãs diferentes para mesclar.": "병합하려면 서로 다른 클랜을 선택하세요.",
  "Essa guerra já está encerrada.": "이미 종료된 전쟁입니다.",
  "Esse usuário já existe.": "이미 존재하는 아이디입니다.",
  "Este personagem ainda não está ligado a um jogador.":
    "이 캐릭터는 아직 플레이어와 연결되지 않았습니다.",
  "Guerra encerrada.": "전쟁이 종료되었습니다.",
  "Guerra iniciada. O tempo está sendo contado.": "전쟁이 시작되어 시간이 집계됩니다.",
  "Guerra não encontrada.": "전쟁을 찾을 수 없습니다.",
  "Guerra registrada e encerrada.": "전쟁이 등록되고 종료되었습니다.",
  "Há um prêmio inválido na seleção.": "선택 항목에 잘못된 보상이 있습니다.",
  "Informe o início da guerra.": "전쟁 시작 시간을 입력하세요.",
  "Informe o início e o fim da semana.": "주 시작일과 종료일을 입력하세요.",
  "Informe o nome de exibição.": "표시 이름을 입력하세요.",
  "Informe o nome do lançamento.": "항목 이름을 입력하세요.",
  "Informe o nome do personagem.": "캐릭터 이름을 입력하세요.",
  "Informe um nome de time com pelo menos 2 caracteres.": "팀 이름을 2자 이상 입력하세요.",
  "Informe um poder válido.": "올바른 전투력을 입력하세요.",
  "Informe um valor válido.": "올바른 금액을 입력하세요.",
  "Já existe outro personagem com esse nome no servidor.":
    "같은 이름의 다른 캐릭터가 이미 서버에 있습니다.",
  "Já existe um personagem com esse nome neste servidor.":
    "같은 이름의 캐릭터가 이미 이 서버에 있습니다.",
  "Já existe um time com esse nome neste servidor.": "같은 이름의 팀이 이미 이 서버에 있습니다.",
  "Já existe uma semana começando nesse dia.": "그 날짜에 시작하는 주차가 이미 있습니다.",
  "Jogador não encontrado neste servidor.": "이 서버에서 플레이어를 찾을 수 없습니다.",
  "Jogador não está no elenco desta semana.": "플레이어가 이번 주 명단에 없습니다.",
  "Jogador removido do elenco.": "플레이어를 명단에서 제거했습니다.",
  "Lançamento não encontrado.": "항목을 찾을 수 없습니다.",
  "Membro inválido para este clã.": "이 클랜에 속하지 않은 멤버입니다.",
  "Não foi possível criar a semana.": "주차를 만들 수 없습니다.",
  "Não foi possível criar o time.": "팀을 만들 수 없습니다.",
  "Não foi possível criar o usuário.": "사용자를 만들 수 없습니다.",
  "Não foi possível cadastrar o personagem.": "캐릭터를 등록할 수 없습니다.",
  "Não foi possível salvar o time do personagem.": "캐릭터 팀을 저장할 수 없습니다.",
  "Não foi possível salvar.": "저장할 수 없습니다.",
  "Nenhum jogador novo para adicionar.": "추가할 새 플레이어가 없습니다.",
  "Nenhum servidor com dono definido.": "소유자가 지정된 서버가 없습니다.",
  "Nenhum servidor está com a sincronização ativada.": "동기화가 켜진 서버가 없습니다.",
  "O fim precisa ser depois do início.": "종료는 시작 이후여야 합니다.",
  "O início da guerra está no futuro. Ajuste o registro.":
    "전쟁 시작이 미래입니다. 기록을 수정하세요.",
  "O nome não pode ficar vazio.": "이름은 비워둘 수 없습니다.",
  "O time escolhido não pertence a este servidor.": "선택한 팀이 이 서버 소속이 아닙니다.",
  "Pagamento do jogador atualizado.": "플레이어 급여가 업데이트되었습니다.",
  "Papel inválido.": "역할이 잘못되었습니다.",
  "Percentual inválido.": "비율이 잘못되었습니다.",
  "Perfil atualizado.": "프로필이 업데이트되었습니다.",
  "Personagem cadastrado manualmente.": "캐릭터를 수동으로 등록했습니다.",
  "Personagem não encontrado.": "캐릭터를 찾을 수 없습니다.",
  "Postura inválida.": "관계가 잘못되었습니다.",
  "Precisa existir pelo menos um administrador ativo.": "활성 관리자가 최소 한 명 있어야 합니다.",
  "Preferência inválida.": "보상 설정이 잘못되었습니다.",
  "Produção vai nos três espaços de vale; aqui entram só custos.":
    "생산은 계곡 세 칸에 입력하고, 여기에는 비용만 넣습니다.",
  "Registro de guerra removido.": "전쟁 기록을 삭제했습니다.",
  "Seleção de presenças inválida.": "참석 선택이 잘못되었습니다.",
  "Seleção inválida.": "선택이 잘못되었습니다.",
  "Selecione ao menos um jogador.": "플레이어를 하나 이상 선택하세요.",
  "Selecione dois clãs válidos.": "유효한 클랜 두 개를 선택하세요.",
  "Sem permissão de edição neste servidor.": "이 서버에서 편집 권한이 없습니다.",
  "Sem permissão para alterar este registro.": "이 기록을 변경할 권한이 없습니다.",
  "Sem permissão para criar times neste servidor.": "이 서버에서 팀을 만들 권한이 없습니다.",
  "Sem permissão para definir a postura dos clãs neste servidor.":
    "이 서버에서 클랜 관계를 지정할 권한이 없습니다.",
  "Sem permissão para definir este servidor casa.": "이 소속 서버를 지정할 권한이 없습니다.",
  "Sem permissão para editar times neste servidor.": "이 서버에서 팀을 편집할 권한이 없습니다.",
  "Sem permissão para remover times neste servidor.": "이 서버에서 팀을 삭제할 권한이 없습니다.",
  "Sem permissão para vincular clãs a times neste servidor.":
    "이 서버에서 클랜을 팀에 연결할 권한이 없습니다.",
  "Sem permissão para vincular jogadores aos clãs neste servidor.":
    "이 서버에서 플레이어를 클랜에 연결할 권한이 없습니다.",
  "Semana não encontrada.": "주차를 찾을 수 없습니다.",
  "Senha redefinida. Sessões antigas foram encerradas.":
    "비밀번호가 재설정되고 기존 세션이 종료되었습니다.",
  "Servidor da guerra inválido ou sem acesso.": "전쟁 서버가 잘못되었거나 접근 권한이 없습니다.",
  "Servidor inválido ou sem permissão de edição.": "서버가 잘못되었거나 편집 권한이 없습니다.",
  "Servidor inválido ou sem permissão para administrá-lo.":
    "서버가 잘못되었거나 관리 권한이 없습니다.",
  "Servidor inválido ou sem permissão para distribuir o prêmio.":
    "서버가 잘못되었거나 보상 배분 권한이 없습니다.",
  "Servidor inválido ou sem permissão para marcar presenças.":
    "서버가 잘못되었거나 참석 표시 권한이 없습니다.",
  "Servidor inválido ou sem permissão para registrar encontros.":
    "서버가 잘못되었거나 일정 등록 권한이 없습니다.",
  "Servidor inválido.": "서버가 잘못되었습니다.",
  "Servidor não encontrado.": "서버를 찾을 수 없습니다.",
  "Time inválido.": "팀이 잘못되었습니다.",
  "Tipo de guerra inválido.": "전쟁 유형이 잘못되었습니다.",
  "Usuário desativado.": "사용자를 비활성화했습니다.",
  "Usuário deve ter de 3 a 32 caracteres: letras, números, ponto, hífen ou _.":
    "아이디는 3~32자이며 문자, 숫자, 점, 하이픈, 밑줄만 사용할 수 있습니다.",
  "Usuário não encontrado.": "사용자를 찾을 수 없습니다.",
  "Usuário reativado.": "사용자를 다시 활성화했습니다.",
  "Vale inválido.": "계곡이 잘못되었습니다.",
  "Você não pode alterar o seu próprio papel.": "자신의 역할은 변경할 수 없습니다.",
  "Você não pode desativar o seu próprio usuário.": "자신의 계정은 비활성화할 수 없습니다.",
  "Acessos removidos. O usuário não verá nenhum servidor.":
    "접근 권한이 제거되어 사용자는 어떤 서버도 볼 수 없습니다.",
  "A seleção inclui um encontro que não é desta semana do servidor.":
    "선택 항목에 이 서버의 이번 주가 아닌 일정이 포함되어 있습니다.",
  "A seleção inclui um jogador que não é dos clãs aliados deste servidor.":
    "선택 항목에 이 서버의 동맹 클랜이 아닌 플레이어가 포함되어 있습니다.",
  "A seleção inclui um membro que não é dos clãs aliados deste servidor.":
    "선택 항목에 이 서버의 동맹 클랜이 아닌 멤버가 포함되어 있습니다.",
  "Cada membro só pode receber um baú de cada raridade.":
    "각 멤버는 등급별로 상자를 하나만 받을 수 있습니다.",
  "Informe um horário válido (HH:MM) para o encontro.": "일정 시간을 올바르게(HH:MM) 입력하세요.",
  "Informe uma data válida para o encontro.": "일정 날짜를 올바르게 입력하세요.",
  "A senha precisa ter pelo menos 8 caracteres.": "비밀번호는 8자 이상이어야 합니다.",
  "A senha é longa demais.": "비밀번호가 너무 깁니다.",
  "Plano de {clan} salvo.": "{clan} 계획이 저장되었습니다.",
  "{clan}: postura removida.": "{clan}: 관계가 제거되었습니다.",
  "{clan}: {stance}.": "{clan}: {stance}.",
  "{player} não está em {clan}.": "{player} 님은 {clan}에 없습니다.",
  "{player} saiu de {clan}.": "{player} 님이 {clan}에서 나갔습니다.",
  "{player} já está em {clan}.": "{player} 님은 이미 {clan}에 있습니다.",
  "{player} vinculado a {clan}.": "{player} 님을 {clan}에 연결했습니다.",
  "{clan} agora está em {team}.": "{clan}이(가) 이제 {team}에 있습니다.",
  "{clan} sem time.": "{clan} 팀 없음.",
  "Usuário {username} criado. Defina os servidores liberados abaixo.":
    "사용자 {username} 생성됨. 아래에서 권한 서버를 지정하세요.",
  "Custo lançado: {name}.": "비용 등록: {name}.",
  "{vale} limpo.": "{vale} 초기화됨.",
  "{vale} salvo.": "{vale} 저장됨.",
  "Lançamento removido: {name}.": "항목 삭제: {name}.",
  "Time {name} criado.": "{name} 팀이 생성되었습니다.",
  "Time {name} atualizado.": "{name} 팀이 업데이트되었습니다.",
  "Time {team} removido.": "{team} 팀이 삭제되었습니다.",
  "Servidor casa definido: {server}.": "소속 서버가 지정되었습니다: {server}.",
  "Encontro de {date} às {time} registrado.": "{date} {time} 일정이 등록되었습니다.",
  "{source} agora é tratado como {target}: {count} personagem(ns) reapontado(s).":
    "{source}을(를) {target}(으)로 병합했습니다. 재지정된 캐릭터: {count}.",
  "Servidores liberados: {count}.": "권한 서버: {count}개.",
  "Servidores com dono definido: {count}.": "소유자가 지정된 서버: {count}개.",
  "Jogadores adicionados ao elenco: {count}.": "명단에 추가된 플레이어: {count}명.",
  "Aliados adicionados ao elenco: {count}.": "명단에 추가된 동맹: {count}명.",
  "Semana criada com {count} jogadores dos clãs aliados no elenco.":
    "주차가 생성되었습니다. 동맹 클랜 플레이어 {count}명이 명단에 포함됐습니다.",
  "Semana criada. Nenhum jogador aliado encontrado para o elenco.":
    "주차가 생성되었습니다. 명단에 넣을 동맹 플레이어가 없습니다.",
  "Semana removida com produção, custos e elenco.": "주차가 생산·비용·명단과 함께 삭제되었습니다.",
  "{label}: sincronização ativada.": "{label}: 동기화가 켜졌습니다.",
  "{label}: sincronização desativada.": "{label}: 동기화가 꺼졌습니다.",
  "Servidores com falha: {failed}. {detail}": "실패한 서버: {failed}. {detail}",
  "Informe o valor do {vale}.": "{vale} 금액을 입력하세요.",
  "Coeficiente da faixa {tier} inválido.": "{tier} 구간의 계수가 잘못되었습니다.",
  "Poder mínimo da faixa {tier} inválido.": "{tier} 구간의 최소 전투력이 잘못되었습니다.",
  "Baú de {month} salvo: {chests} baú(s) para {members} membro(s).":
    "{month} 상자 저장됨: 상자 {chests}개 · 대상 {members}명.",
  "falha ao sincronizar.": "동기화 실패.",
  "ranking vazio.": "랭킹이 비어 있음.",
  "{label}: {read} jogadores lidos, {created} novos, {updated} atualizados.":
    "{label}: {read}명 조회, 신규 {created}명, 업데이트 {updated}명.",
  "Servidores sincronizados: {count} · novos: {created} · atualizados: {updated}.":
    "동기화된 서버: {count} · 신규: {created} · 업데이트: {updated}.",
  "Selecione um jogador do ranking geral do jogo.": "게임 전체 랭킹에서 플레이어를 선택하세요.",
  "Jogador não encontrado no ranking geral do jogo.":
    "게임 전체 랭킹에서 플레이어를 찾을 수 없습니다.",
  "Esse jogador é deste servidor: marque a presença dele na tabela acima.":
    "이 서버 소속 플레이어입니다. 위 표에서 참석을 표시하세요.",
  "Esse jogador já está no bloco custom.": "이미 커스텀 블록에 있는 플레이어입니다.",
  "Não foi possível adicionar o membro.": "멤버를 추가하지 못했습니다.",
  "Servidor inválido ou sem permissão para montar o bloco custom.":
    "서버가 잘못되었거나 커스텀 블록을 만들 권한이 없습니다.",
  "Sem permissão para mexer no bloco custom deste servidor.":
    "이 서버의 커스텀 블록을 변경할 권한이 없습니다.",
  "Membro inválido ou sem permissão para removê-lo.": "멤버가 잘못되었거나 제거할 권한이 없습니다.",
  "Membro removido do bloco custom junto com as presenças dele.":
    "멤버와 해당 참석 기록이 커스텀 블록에서 제거되었습니다.",
  "{name} entrou no bloco custom.": "{name}님이 커스텀 블록에 추가되었습니다.",
  "Presenças do bloco custom salvas: {marks} em {fights} encontro(s).":
    "커스텀 블록 참석 저장됨: {marks}건 · {fights}개 일정.",
  "A seleção inclui um membro que não está no bloco custom deste servidor.":
    "선택에 이 서버의 커스텀 블록에 없는 멤버가 포함되어 있습니다.",
  "Pagamento do jogador marcado como pago.": "플레이어 급여를 지급으로 표시했습니다.",
  "Pagamento do jogador marcado como pendente.": "플레이어 급여를 미지급으로 표시했습니다.",
  "Membro inválido.": "멤버가 잘못되었습니다.",
  "Membro não tem baú neste mês.": "이번 달에 상자가 없는 멤버입니다.",
  "Baús de {name} marcados como entregues.": "{name}님의 상자를 전달로 표시했습니다.",
  "Entrega dos baús de {name} desmarcada.": "{name}님의 상자 전달 표시를 취소했습니다.",
  "Escolha um membro de outro clã aliado.": "다른 동맹 클랜 멤버를 선택하세요.",
  "Esse membro não é convidado deste plano.": "이 멤버는 이 계획의 게스트가 아닙니다.",
  "{name} entrou na CE de {clan} como convidado.": "{name}님이 {clan} CE에 게스트로 참여했습니다.",
  "Convidado removido da CE de {clan}.": "{clan} CE에서 게스트를 제거했습니다.",
};

const tables: Record<Locale, Record<string, string>> = { pt: {}, en, es, ko };

export function translateMessage(locale: Locale, message: string, vars?: Vars): string {
  const template = locale === DEFAULT_LOCALE ? message : tables[locale]?.[message] ?? message;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export type MessageTranslator = (message: string, vars?: Vars) => string;
