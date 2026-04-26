function countResolvedHelpRequests(helpRequests = []) {
  return helpRequests.filter((request) => request.status === 'resolved').length;
}

export function generateReport({
  participants = [],
  helpRequests = [],
  resolutions = [],
  currentStepIndex = -1,
  totalSteps = 0,
} = {}) {
  const userParticipants = participants.filter((participant) => participant.role === 'user');
  const completedUsers = userParticipants.filter(
    (participant) => totalSteps > 0 && participant.completedStepIds.length >= totalSteps,
  );

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalParticipants: userParticipants.length,
      totalConnections: participants.length,
      totalSteps,
      currentStepIndex,
      completedParticipants: completedUsers.length,
      outstandingHelpRequests: helpRequests.filter((request) => request.status !== 'resolved').length,
      resolvedHelpRequests: countResolvedHelpRequests(helpRequests),
      resolutionEvents: resolutions.length,
    },
    participants: userParticipants.map((participant) => ({
      participantId: participant.participantId,
      seatLabel: participant.seatLabel,
      currentStepId: participant.currentStepId,
      currentStepTitle: participant.currentStepTitle,
      completedStepIds: participant.completedStepIds,
      currentStepActionIds: participant.currentStepActionIds,
      activeHelpRequestId: participant.activeHelpRequestId,
      lastSeenAt: participant.lastSeenAt,
    })),
    helpRequests: helpRequests.map((request) => ({
      requestId: request.requestId,
      participantId: request.participantId,
      seatLabel: request.seatLabel,
      stepId: request.stepId,
      stepTitle: request.stepTitle,
      status: request.status,
      requestedAt: request.requestedAt,
      resolvedAt: request.resolvedAt ?? null,
      usherId: request.usherId ?? null,
      notes: request.notes ?? '',
    })),
    resolutions,
  };
}

export function formatReportAsText(report) {
  const lines = [
    `Workshop report generated at ${report.generatedAt}`,
    `Participants: ${report.summary.totalParticipants}`,
    `Completed participants: ${report.summary.completedParticipants}`,
    `Outstanding help requests: ${report.summary.outstandingHelpRequests}`,
    `Resolved help requests: ${report.summary.resolvedHelpRequests}`,
    '',
    'Participant summary:',
  ];

  for (const participant of report.participants) {
    lines.push(
      `- ${participant.participantId} (${participant.seatLabel || 'No seat assigned'}) -> ${participant.currentStepTitle || 'Waiting for steps'}`,
    );
  }

  if (report.helpRequests.length > 0) {
    lines.push('');
    lines.push('Help requests:');

    for (const request of report.helpRequests) {
      lines.push(
        `- ${request.requestId}: ${request.participantId} at ${request.seatLabel || 'Unknown seat'} (${request.status})`,
      );
    }
  }

  return lines.join('\n');
}

export default generateReport;
